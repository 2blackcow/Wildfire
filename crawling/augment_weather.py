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

def has_complete_weather_data(fire_data):
    """기상 데이터가 완전히 있는지 확인"""
    required_fields = ["temp", "wspd", "wdir", "precip", "rhum"]
    
    for field in required_fields:
        value = fire_data.get(field)
        # None이거나 빈 문자열이면 불완전한 것으로 판단
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

    today = datetime.now().strftime("%Y-%m-%d")
    print(f"🔥 화재 데이터 {len(fires)}개 처리 시작...")
    print(f"📅 오늘({today}) 이전 날짜만 기상 데이터 수집")

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
        date = fire.get("frfr_frng_dtm", "")[:10]

        print(f"[{i}/{len(fires)}] {fire_id} - {date}", end=" ")

        # 기존 데이터 확인
        if fire_id in existing_map:
            existing_fire = existing_map[fire_id]
            
            # 🔄 기상 데이터 업데이트 필요성 체크
            if needs_weather_update(existing_fire, fire):
                print("🔄 기상 데이터 업데이트 필요", end=" ")
                
                # 기존 데이터를 새 데이터로 업데이트
                updated_fire = fire.copy()
                
                # 기존에 있던 기상 데이터는 유지 (None이 아닌 경우)
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
        if not (lat and lon and date):
            print("❌ 필수 데이터 누락")
            skipped += 1
            continue

        # 미래 날짜 처리
        if date >= today:
            print("⏭️ 미래 날짜")
            fire.update({"temp": None, "wspd": None, "wdir": None, "precip": None, "rhum": None})
            enriched.append(fire)
            skipped += 1
            continue

        # 🌤️ 기상 데이터 수집 (누락된 데이터만)
        key = (lat, lon, date)
        need_meteostat = any(fire.get(field) is None for field in ["temp", "wspd", "wdir"])
        need_weatherbit = any(fire.get(field) is None for field in ["precip", "rhum"])

        if need_meteostat or need_weatherbit:
            print("🌤️ 수집중...", end="")
            
            if need_meteostat:
                if key in cache_meteostat:
                    weather1 = cache_meteostat[key]
                else:
                    weather1 = get_meteostat(lat, lon, date)
                    cache_meteostat[key] = weather1
                
                # None인 필드만 업데이트
                for field in ["temp", "wspd", "wdir"]:
                    if fire.get(field) is None and weather1.get(field) is not None:
                        fire[field] = weather1[field]

            if need_weatherbit:
                if key in cache_weatherbit:
                    weather2 = cache_weatherbit[key]
                else:
                    weather2 = get_weatherbit(lat, lon, date)
                    cache_weatherbit[key] = weather2
                
                # None인 필드만 업데이트
                for field in ["precip", "rhum"]:
                    if fire.get(field) is None and weather2.get(field) is not None:
                        fire[field] = weather2[field]

            api_calls += 1
            updated += 1
            print(" ✅ 완료")
            time.sleep(1)
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