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

def parse_datetime(datetime_str):
    """날짜시간 문자열을 파싱하여 datetime 객체 반환"""
    if not datetime_str:
        return None
    
    try:
        # "2025-06-07 12:40" 형태
        if len(datetime_str) >= 16:
            return datetime.strptime(datetime_str[:16], "%Y-%m-%d %H:%M")
        # "2025-06-07" 형태
        elif len(datetime_str) >= 10:
            return datetime.strptime(datetime_str[:10], "%Y-%m-%d")
        else:
            return None
    except ValueError:
        return None

def get_meteostat_hourly(lat, lon, target_datetime):
    """시간별 Meteostat 데이터 수집"""
    date_str = target_datetime.strftime("%Y-%m-%d")
    
    url = f"https://meteostat.p.rapidapi.com/point/hourly"
    params = {
        "lat": lat,
        "lon": lon,
        "start": date_str,
        "end": date_str,
        "alt": "50",  # 기본 고도 50m
        "tz": "Asia/Seoul"
    }
    headers = { 
        "x-rapidapi-key": METEOSTAT_API_KEY,
        "x-rapidapi-host": "meteostat.p.rapidapi.com"
    }
    
    try:
        res = requests.get(url, headers=headers, params=params)
        res.raise_for_status()
        response_data = res.json()
        data = response_data.get("data", [])
        
        if not data:
            return {"temp": None, "wspd": None, "wdir": None}
        
        # 목표 시간에 가장 가까운 데이터 찾기
        target_hour = target_datetime.hour
        best_match = None
        min_diff = float('inf')
        
        for hour_data in data:
            time_str = hour_data.get("time", "")
            if time_str:
                try:
                    hour_time = datetime.strptime(time_str, "%Y-%m-%d %H:%M:%S")
                    diff = abs(hour_time.hour - target_hour)
                    if diff < min_diff:
                        min_diff = diff
                        best_match = hour_data
                except ValueError:
                    continue
        
        if best_match:
            return {
                "temp": best_match.get("temp"),
                "wspd": best_match.get("wspd"),  # km/h 단위
                "wdir": best_match.get("wdir")
            }
        else:
            return {"temp": None, "wspd": None, "wdir": None}
            
    except Exception as e:
        print(f"❌ Meteostat API 오류 ({date_str}): {e}")
        return {"temp": None, "wspd": None, "wdir": None}

def get_weatherbit_hourly(lat, lon, target_datetime):
    """시간별 Weatherbit 데이터 수집 (일별 데이터에서 추출)"""
    date_str = target_datetime.strftime("%Y-%m-%d")
    next_date = target_datetime + timedelta(days=1)
    end_date_str = next_date.strftime("%Y-%m-%d")
    
    # Weatherbit hourly는 유료 플랜에서만 제공되므로 daily 데이터 사용
    url = f"https://api.weatherbit.io/v2.0/history/daily"
    params = {
        "lat": lat,
        "lon": lon,
        "start_date": date_str,
        "end_date": end_date_str,
        "key": WEATHERBIT_API_KEY
    }
    
    try:
        res = requests.get(url, params=params)
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
            return {"precip": None, "rhum": None}
            
    except Exception as e:
        print(f"❌ Weatherbit API 오류 ({date_str}): {e}")
        return {"precip": None, "rhum": None}

def has_complete_weather_data(fire_data):
    """기상 데이터가 완전히 있는지 확인"""
    required_fields = ["temp", "wspd", "wdir", "precip", "rhum"]
    
    for field in required_fields:
        value = fire_data.get(field)
        if value is None or value == "":
            return False
    
    return True

def needs_weather_update(existing_fire, new_fire):
    """기상 데이터 업데이트가 필요한지 확인"""
    # 1. 기존 데이터에 기상 정보가 없으면 업데이트 필요
    if not has_complete_weather_data(existing_fire):
        return True
    
    # 2. 좌표가 변경되었으면 업데이트 필요
    if (existing_fire.get("frfr_lctn_ycrd") != new_fire.get("frfr_lctn_ycrd") or
        existing_fire.get("frfr_lctn_xcrd") != new_fire.get("frfr_lctn_xcrd")):
        return True
    
    # 3. 발생일시가 변경되었으면 업데이트 필요
    if existing_fire.get("frfr_frng_dtm") != new_fire.get("frfr_frng_dtm"):
        return True
    
    return False

def augment_weather():
    root_dir = os.path.abspath(os.path.join(__file__, "..", ".."))
    input_path = os.path.join(root_dir, "public", "data", "korea_fire_live.json")
    output_path = os.path.join(root_dir, "public", "data", "korea_fire_weather.json")

    if not os.path.exists(input_path):
        print(f"❌ 입력 파일 없음: {input_path}")
        return

    with open(input_path, "r", encoding="utf-8") as f:
        fires = json.load(f)

    # 기존 결합된 데이터 로드
    if os.path.exists(output_path):
        with open(output_path, "r", encoding="utf-8") as f:
            existing_data = json.load(f)
        existing_map = {d["frfr_info_id"]: d for d in existing_data}
    else:
        existing_map = {}

    now = datetime.now()
    today = now.strftime("%Y-%m-%d")
    print(f"🔥 화재 데이터 {len(fires)}개 처리 시작...")
    print(f"📅 시간별 기상 데이터 수집 (3시간 이전 데이터만)")

    enriched = []
    api_calls = 0
    skipped = 0
    updated = 0
    cache_meteostat = {}
    cache_weatherbit = {}

    for i, fire in enumerate(fires, 1):
        fire_id = fire.get('frfr_info_id')
        lat = fire.get("frfr_lctn_ycrd")
        lon = fire.get("frfr_lctn_xcrd")
        datetime_str = fire.get("frfr_frng_dtm", "")

        print(f"[{i}/{len(fires)}] {fire_id} - {datetime_str}", end=" ")

        # 기존 데이터 확인
        if fire_id in existing_map:
            existing_fire = existing_map[fire_id]
            
            if needs_weather_update(existing_fire, fire):
                print("🔄 기상 데이터 업데이트 필요", end=" ")
                updated_fire = fire.copy()
                
                # 기존에 있던 기상 데이터는 유지
                for weather_field in ["temp", "wspd", "wdir", "precip", "rhum"]:
                    if existing_fire.get(weather_field) is not None:
                        updated_fire[weather_field] = existing_fire[weather_field]
                
                fire = updated_fire
            else:
                print("✅ 기상 데이터 완료 → 기존 데이터 사용")
                enriched.append(existing_fire)
                skipped += 1
                continue

        # 필수 데이터 검증
        if not (lat and lon and datetime_str):
            print("❌ 필수 데이터 누락")
            fire.update({"temp": None, "wspd": None, "wdir": None, "precip": None, "rhum": None})
            enriched.append(fire)
            skipped += 1
            continue

        # 날짜시간 파싱
        target_datetime = parse_datetime(datetime_str)
        if not target_datetime:
            print("❌ 날짜시간 파싱 실패")
            fire.update({"temp": None, "wspd": None, "wdir": None, "precip": None, "rhum": None})
            enriched.append(fire)
            skipped += 1
            continue

        # 시간 제한: 현재 시간보다 3시간 이전 데이터만 수집
        time_diff = now - target_datetime
        if time_diff.total_seconds() < 3 * 3600:  # 3시간 = 3 * 3600초
            print("⏭️ 너무 최근 데이터 (3시간 이내)")
            fire.update({"temp": None, "wspd": None, "wdir": None, "precip": None, "rhum": None})
            enriched.append(fire)
            skipped += 1
            continue

        # 🌤️ 기상 데이터 수집
        cache_key = (lat, lon, target_datetime.strftime("%Y-%m-%d %H"))
        need_meteostat = any(fire.get(field) is None for field in ["temp", "wspd", "wdir"])
        need_weatherbit = any(fire.get(field) is None for field in ["precip", "rhum"])

        if need_meteostat or need_weatherbit:
            print("🌤️ 수집중...", end="")
            
            if need_meteostat:
                if cache_key in cache_meteostat:
                    weather1 = cache_meteostat[cache_key]
                else:
                    weather1 = get_meteostat_hourly(lat, lon, target_datetime)
                    cache_meteostat[cache_key] = weather1
                
                # None인 필드만 업데이트
                for field in ["temp", "wspd", "wdir"]:
                    if fire.get(field) is None and weather1.get(field) is not None:
                        fire[field] = weather1[field]

            if need_weatherbit:
                daily_cache_key = (lat, lon, target_datetime.strftime("%Y-%m-%d"))
                if daily_cache_key in cache_weatherbit:
                    weather2 = cache_weatherbit[daily_cache_key]
                else:
                    weather2 = get_weatherbit_hourly(lat, lon, target_datetime)
                    cache_weatherbit[daily_cache_key] = weather2
                
                # None인 필드만 업데이트
                for field in ["precip", "rhum"]:
                    if fire.get(field) is None and weather2.get(field) is not None:
                        fire[field] = weather2[field]

            api_calls += 1
            updated += 1
            print(" ✅ 완료")
            time.sleep(1.2)  # 시간별 데이터는 더 많은 요청이므로 대기 시간 증가
        else:
            print("✅ 기상 데이터 이미 완료")

        enriched.append(fire)

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(enriched, f, ensure_ascii=False, indent=2)

    print(f"\n🎉 처리 완료!")
    print(f"📁 저장 위치: {output_path}")
    print(f"📊 총 {len(enriched)}개 데이터 처리")
    print(f"🌐 {api_calls}개 항목에 기상 데이터 추가")
    print(f"🔄 {updated}개 항목 업데이트됨")
    print(f"⏭️ {skipped}개 항목 건너뜀")

if __name__ == "__main__":
    augment_weather()