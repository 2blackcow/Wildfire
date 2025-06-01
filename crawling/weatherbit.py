import pandas as pd
import requests
import os
import time
from dotenv import load_dotenv
from datetime import datetime, timedelta

# ✅ .env 불러오기
load_dotenv()
API_KEY = os.getenv("WEATHERBIT_KEY")

# ✅ 파일 경로
INPUT = "train_fire_data.csv"
OUTPUT = "train_fire_data_with_weatherbit.csv"

# ✅ 데이터 불러오기
df = pd.read_csv(INPUT)
df["강수량 (precip)"] = None
df["습도 (rh)"] = None

# ✅ Weatherbit 호출 함수
def get_weatherbit(lat, lon, date_str):
    start = datetime.strptime(date_str, "%Y-%m-%d")
    end = start + timedelta(days=1)

    url = "https://api.weatherbit.io/v2.0/history/daily"
    params = {
        "lat": round(lat, 3),
        "lon": round(lon, 3),
        "start_date": start.strftime("%Y-%m-%d"),
        "end_date": end.strftime("%Y-%m-%d"),
        "key": API_KEY
    }

    try:
        res = requests.get(url, params=params, timeout=10)
        result = res.json()
        if res.status_code == 200 and "data" in result:
            data = result["data"][0]
            return data.get("precip"), data.get("rh")
    except Exception as e:
        print(f"[ERROR] {lat}, {lon}, {date_str} → {e}")
    return None, None

# ✅ 반복 병합
for i in range(len(df)):
    lat = df.loc[i, "위도"]
    lon = df.loc[i, "경도"]
    date = df.loc[i, "acq_date"]

    if pd.isna(lat) or pd.isna(lon):
        continue

    precip, rh = get_weatherbit(lat, lon, date)
    df.loc[i, "강수량 (precip)"] = precip
    df.loc[i, "습도 (rh)"] = rh

    print(f"[{i+1}/{len(df)}] {date} ({round(lat, 3)}, {round(lon, 3)}) → 강수량={precip}, 습도={rh}")
    time.sleep(1.1)  

# ✅ 저장
df.to_csv(OUTPUT, index=False, encoding="utf-8-sig")
print(f"\n✅ Weatherbit 데이터 병합 완료: {OUTPUT}")
