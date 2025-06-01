import pandas as pd
import requests
import os
import time
from dotenv import load_dotenv

# ✅ .env 불러오기
load_dotenv()
API_KEY = os.getenv("METEOSTAT_KEY")
API_HOST = "meteostat.p.rapidapi.com"

# ✅ 파일 경로
INPUT = "wildfire_geocoded_2024_10_to_2025_04.csv"
OUTPUT = "train_fire_data.csv"

# ✅ 데이터 불러오기
df = pd.read_csv(INPUT)
df["acq_date"] = df["발생일시"].str[:10]  # YYYY-MM-DD
df["temp"] = None
df["wspd"] = None
df["wdir"] = None

# ✅ 기상데이터 호출 함수
def get_weather(lat, lon, date):
    url = "https://meteostat.p.rapidapi.com/point/daily"
    headers = {
        "X-RapidAPI-Key": API_KEY,
        "X-RapidAPI-Host": API_HOST
    }
    params = {
        "lat": lat,
        "lon": lon,
        "start": date,
        "end": date
    }
    try:
        res = requests.get(url, headers=headers, params=params, timeout=10)
        result = res.json()
        if res.status_code == 200 and result.get("data"):
            data = result["data"][0]
            return data.get("tavg"), data.get("wspd"), data.get("wdir")
    except Exception as e:
        print(f"[ERROR] {lat}, {lon}, {date} → {e}")
    return None, None, None

# ✅ 각 행마다 병합
for i in range(len(df)):
    lat = df.loc[i, "위도"]
    lon = df.loc[i, "경도"]
    date = df.loc[i, "acq_date"]

    if pd.isna(lat) or pd.isna(lon):
        continue

    temp, wspd, wdir = get_weather(lat, lon, date)
    df.loc[i, "temp"] = temp
    df.loc[i, "wspd"] = wspd
    df.loc[i, "wdir"] = wdir

    print(f"[{i+1}/{len(df)}] {date} ({lat}, {lon}) → T={temp}, WS={wspd}, WD={wdir}")
    time.sleep(0.3)

# ✅ 결과 저장 전 열 이름 변경
df.rename(columns={
    "temp": "평균기온 (temp)",
    "wspd": "평균풍속 (wspd)",
    "wdir": "풍향각도 (wdir)"
}, inplace=True)

# ✅ 결과 저장
df.to_csv(OUTPUT, index=False, encoding="utf-8-sig")
print(f"\n✅ 기상 데이터 병합 완료: {OUTPUT}")
