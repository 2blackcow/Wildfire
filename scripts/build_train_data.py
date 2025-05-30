from dotenv import load_dotenv
import pandas as pd
import numpy as np
import requests
import os
from tqdm import tqdm

# 🔐 RapidAPI 키 로드 (.env에 METEOSTAT_KEY로 저장)
load_dotenv()
API_KEY = os.getenv("METEOSTAT_KEY")

if not API_KEY:
    raise RuntimeError("❌ METEOSTAT_KEY 환경변수가 설정되지 않았습니다.")

# 📄 경로 정의
FIRE_CSV = "data/fire_archive_J1V-C2_618777.csv"
OUTPUT_CSV = "data/train_fire_data.csv"

# 🌡️ Meteostat (RapidAPI) 호출 함수
def get_weather(lat, lon, date):
    url = "https://meteostat.p.rapidapi.com/point/daily"
    headers = {
        "X-RapidAPI-Key": API_KEY,
        "X-RapidAPI-Host": "meteostat.p.rapidapi.com"
    }
    params = {
        "lat": lat,
        "lon": lon,
        "start": date,
        "end": date
    }
    res = requests.get(url, headers=headers, params=params)
    if res.status_code != 200:
        raise ValueError(f"API 호출 실패 {res.status_code}: {res.text}")
    
    data = res.json()
    if "data" not in data or not data["data"]:
        return None
    
    w = data["data"][0]
    return {
        "temp": w.get("tavg", 25),
        "wspd": w.get("wspd", 3.0),
        "rhum": w.get("rhum", 50)
    }

# 🔥 화재 데이터 로딩
df = pd.read_csv(FIRE_CSV)

rows = []
print(f"🔥 총 {len(df)}개의 화재 지점에 대해 API 호출 중...")
for i, row in tqdm(df.iterrows(), total=len(df), desc="📡 API 호출 중"):
    lat = row["latitude"]
    lon = row["longitude"]
    date_str = str(row["acq_date"])

    try:
        weather = get_weather(lat, lon, date_str)
        if not weather:
            continue

        rows.append({
            "latitude": lat,
            "longitude": lon,
            "date": date_str,
            "temp": weather["temp"],
            "wspd": weather["wspd"],
            "rhum": weather["rhum"],
            "brightness": row["brightness"],
            "frp": row["frp"],
            "confidence": row["confidence"],
            "fire_occurred": 1
        })
    except Exception as e:
        print(f"❌ 오류 ({lat}, {lon}, {date_str}): {e}")

# 🔁 비화재 샘플 생성
fire_df = pd.DataFrame(rows)
n = min(100, len(fire_df))
no_fire = fire_df.sample(n=n).copy()
no_fire["latitude"] += np.random.uniform(-0.2, 0.2, len(no_fire))
no_fire["longitude"] += np.random.uniform(-0.2, 0.2, len(no_fire))
no_fire["fire_occurred"] = 0

# 💾 최종 CSV 저장
final_df = pd.concat([fire_df, no_fire], ignore_index=True)
final_df.to_csv(OUTPUT_CSV, index=False)

print(f"✅ 훈련용 CSV 저장 완료: {OUTPUT_CSV} (총 {len(final_df)}개)")
