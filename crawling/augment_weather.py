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

# API 키 확인
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
    # end_date를 start_date 다음 날로 설정 (API 요구사항)
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

def augment_weather():
    root_dir = os.path.abspath(os.path.join(__file__, "..", ".."))
    input_path = os.path.join(root_dir, "public", "data", "korea_fire_live.json")
    output_path = os.path.join(root_dir, "public", "data", "korea_fire_weather.json")

    if not os.path.exists(input_path):
        print(f"❌ 입력 파일 없음: {input_path}")
        return

    with open(input_path, "r", encoding="utf-8") as f:
        fires = json.load(f)

    # 날짜 계산
    today = datetime.now().strftime("%Y-%m-%d")
    
    print(f"🔥 화재 데이터 {len(fires)}개 처리 시작...")
    print(f"📅 오늘({today}) 이전 날짜만 기상 데이터 수집")
    
    enriched = []
    api_calls = 0
    skipped = 0

    for i, fire in enumerate(fires, 1):
        fire_id = fire.get('frfr_info_id')
        lat = fire.get("frfr_lctn_ycrd")
        lon = fire.get("frfr_lctn_xcrd")
        date = fire.get("frfr_frng_dtm", "")[:10]

        print(f"[{i}/{len(fires)}] {fire_id} - {date}", end=" ")

        if not (lat and lon and date):
            print("❌ 필수 데이터 누락")
            skipped += 1
            continue

        # 오늘 이후 날짜는 건너뛰기
        if date >= today:
            print("⏭️ 미래 날짜")
            fire.update({"temp": None, "wspd": None, "wdir": None, "precip": None, "rhum": None})
            enriched.append(fire)
            skipped += 1
            continue

        # 기상 데이터 수집
        print("🌤️ 수집중...", end="")
        weather1 = get_meteostat(lat, lon, date)
        weather2 = get_weatherbit(lat, lon, date)
        
        fire.update(weather1)
        fire.update(weather2)
        enriched.append(fire)
        
        api_calls += 1
        print(" ✅ 완료")
        
        # API 제한 대응
        time.sleep(1)

    # 결과 저장
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(enriched, f, ensure_ascii=False, indent=2)

    print(f"\n🎉 처리 완료!")
    print(f"📁 저장 위치: {output_path}")
    print(f"📊 총 {len(enriched)}개 데이터 처리")
    print(f"🌐 {api_calls}개 항목에 기상 데이터 추가")
    print(f"⏭️ {skipped}개 항목 건너뜀")

if __name__ == "__main__":
    augment_weather()