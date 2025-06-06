import json
import requests
import time
import os
from dotenv import load_dotenv
from datetime import datetime, timedelta

# .env 파일 로드
dotenv_path = os.path.abspath(os.path.join(__file__, "..", "..", ".env"))
load_dotenv(dotenv_path)

# API 키 로드
METEOSTAT_API_KEY = os.getenv("METEOSTAT_KEY")
WEATHERBIT_API_KEY = os.getenv("WEATHERBIT_KEY")

if not METEOSTAT_API_KEY or not WEATHERBIT_API_KEY:
    print("❌ API 키가 제대로 로드되지 않았습니다.")
    exit(1)

def get_meteostat(lat, lon, date_str):
    url = f"https://meteostat.p.rapidapi.com/point/daily?lat={lat}&lon={lon}&start={date_str}&end={date_str}"
    headers = { 
        "x-rapidapi-key": METEOSTAT_API_KEY,
        "x-rapidapi-host": "meteostat.p.rapidapi.com"
    }
    
    try:
        res = requests.get(url, headers=headers)
        res.raise_for_status()
        response_data = res.json()
        data = response_data.get("data", [])
        
        if data:
            weather_data = data[0]
            return {
                "temp": weather_data.get("tavg"),
                "wspd": weather_data.get("wspd"),
                "wdir": weather_data.get("wdir")
            }
        else:
            return { "temp": None, "wspd": None, "wdir": None }
            
    except Exception as e:
        print(f"❌ Meteostat API 오류 ({date_str}): {e}")
        return { "temp": None, "wspd": None, "wdir": None }

def get_weatherbit(lat, lon, date_str):
    start_date = datetime.strptime(date_str, "%Y-%m-%d")
    end_date = start_date + timedelta(days=1)
    end_date_str = end_date.strftime("%Y-%m-%d")
    
    url = f"https://api.weatherbit.io/v2.0/history/daily?lat={lat}&lon={lon}&start_date={date_str}&end_date={end_date_str}&key={WEATHERBIT_API_KEY}"
    
    try:
        res = requests.get(url)
        res.raise_for_status()
        response_data = res.json()
        data = response_data.get("data", [])
        
        if data:
            weather_data = data[0]
            return {
                "precip": weather_data.get("precip"),
                "rhum": weather_data.get("rh")
            }
        else:
            return { "precip": None, "rhum": None }
            
    except Exception as e:
        print(f"❌ Weatherbit API 오류 ({date_str}): {e}")
        return { "precip": None, "rhum": None }

def parse_fire_datetime(fire_data):
    """화재 발생 일시를 파싱해서 날짜 문자열 반환"""
    occu_dtm = fire_data.get("occu_dtm", "")
    
    if len(occu_dtm) >= 8:
        # YYYYMMDDHHMMSS 형태에서 YYYY-MM-DD 추출
        date_part = occu_dtm[:8]
        try:
            parsed_date = datetime.strptime(date_part, "%Y%m%d")
            return parsed_date.strftime("%Y-%m-%d")
        except:
            pass
    
    # 다른 형태 시도
    frng_dtm = fire_data.get("frfr_frng_dtm", "")
    if frng_dtm and len(frng_dtm) >= 8:
        try:
            if "-" in frng_dtm:
                return frng_dtm[:10]  # YYYY-MM-DD 형태
            else:
                # YYYYMMDD 형태
                parsed_date = datetime.strptime(frng_dtm[:8], "%Y%m%d")
                return parsed_date.strftime("%Y-%m-%d")
        except:
            pass
    
    return None

def get_fire_coordinates(fire_data):
    """화재 위치 좌표 추출"""
    # 여러 가능한 필드명 시도
    lat_fields = ["frfr_lctn_ycrd", "latitude", "lat", "y_coord"]
    lon_fields = ["frfr_lctn_xcrd", "longitude", "lon", "x_coord"]
    
    lat = None
    lon = None
    
    for field in lat_fields:
        if field in fire_data and fire_data[field]:
            try:
                lat = float(fire_data[field])
                break
            except (ValueError, TypeError):
                continue
    
    for field in lon_fields:
        if field in fire_data and fire_data[field]:
            try:
                lon = float(fire_data[field])
                break
            except (ValueError, TypeError):
                continue
    
    return lat, lon

def augment_historical_weather():
    """과거 화재 데이터에 기상 정보 추가"""
    root_dir = os.path.abspath(os.path.join(__file__, "..", ".."))
    input_path = os.path.join(root_dir, "public", "data", "korea_fire_2024_2025.json")
    output_path = os.path.join(root_dir, "public", "data", "korea_fire_2024_2025_with_weather.json")

    if not os.path.exists(input_path):
        print(f"❌ 입력 파일 없음: {input_path}")
        return

    with open(input_path, "r", encoding="utf-8") as f:
        fires = json.load(f)

    # 기존 기상 데이터가 있는지 확인
    if os.path.exists(output_path):
        with open(output_path, "r", encoding="utf-8") as f:
            existing_data = json.load(f)
        existing_map = {d.get("frfr_info_id"): d for d in existing_data if d.get("frfr_info_id")}
        print(f"🔄 기존 기상 데이터 {len(existing_map)}개 로드됨")
    else:
        existing_map = {}

    print(f"🔥 화재 데이터 {len(fires)}개 처리 시작...")
    print(f"📅 2024-10-01 ~ 2025-04-01 기간 기상 데이터 수집")

    enriched = []
    api_calls = 0
    skipped = 0
    errors = 0
    cache_meteostat = {}
    cache_weatherbit = {}

    for i, fire in enumerate(fires, 1):
        fire_id = fire.get('frfr_info_id')
        
        print(f"[{i}/{len(fires)}] ID: {fire_id}", end=" ")

        # 기존 데이터 확인
        if fire_id and fire_id in existing_map:
            existing_fire = existing_map[fire_id]
            # 기상 데이터가 이미 있는지 확인
            if existing_fire.get("temp") is not None or existing_fire.get("wspd") is not None:
                print("🛑 기존 기상데이터 있음 → 건너뜀")
                enriched.append(existing_fire)
                skipped += 1
                continue

        # 날짜 파싱
        date = parse_fire_datetime(fire)
        if not date:
            print("❌ 날짜 파싱 실패")
            fire.update({"temp": None, "wspd": None, "wdir": None, "precip": None, "rhum": None})
            enriched.append(fire)
            errors += 1
            continue

        # 좌표 추출
        lat, lon = get_fire_coordinates(fire)
        if not (lat and lon):
            print("❌ 좌표 정보 누락")
            fire.update({"temp": None, "wspd": None, "wdir": None, "precip": None, "rhum": None})
            enriched.append(fire)
            errors += 1
            continue

        print(f"({date}) ", end="")

        # 캐시 키
        key = (lat, lon, date)

        # 기상 데이터 수집
        if key in cache_meteostat:
            weather1 = cache_meteostat[key]
        else:
            weather1 = get_meteostat(lat, lon, date)
            cache_meteostat[key] = weather1

        if key in cache_weatherbit:
            weather2 = cache_weatherbit[key]
        else:
            weather2 = get_weatherbit(lat, lon, date)
            cache_weatherbit[key] = weather2

        # 데이터 병합
        fire.update(weather1)
        fire.update(weather2)
        enriched.append(fire)

        api_calls += 1
        print("✅")
        
        # API 부하 방지
        if api_calls % 10 == 0:
            print(f"⏳ {api_calls}개 처리 완료, 잠시 대기...")
            time.sleep(2)
        else:
            time.sleep(0.5)

    # 결과 저장
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(enriched, f, ensure_ascii=False, indent=2)

    print(f"\n🎉 처리 완료!")
    print(f"📁 저장 위치: {output_path}")
    print(f"📊 총 {len(enriched)}개 데이터 처리")
    print(f"🌐 {api_calls}개 항목에 기상 데이터 추가")
    print(f"⏭️ {skipped}개 항목 건너뜀")
    print(f"❌ {errors}개 항목 오류")

    # 샘플 데이터 출력
    if enriched:
        print(f"\n📋 샘플 데이터:")
        sample = enriched[0]
        print(f"  ID: {sample.get('frfr_info_id')}")
        print(f"  발생일시: {sample.get('occu_dtm')}")
        print(f"  위치: {sample.get('addr', 'N/A')}")
        print(f"  기온: {sample.get('temp')}°C")
        print(f"  풍속: {sample.get('wspd')} m/s")
        print(f"  습도: {sample.get('rhum')}%")

if __name__ == "__main__":
    augment_historical_weather()