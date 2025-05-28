import pandas as pd
import requests
from tqdm import tqdm
import time
import os

os.makedirs("data/merged", exist_ok=True)

# 🔑 Meteostat RapidAPI 키 가져오기 (.env에 저장해도 되고 직접 넣어도 됨)
API_KEY = os.getenv("METEOSTAT_KEY") or "YOUR_RAPIDAPI_KEY"

def get_meteostat(lat, lon, date):
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
    try:
        res = requests.get(url, headers=headers, params=params, timeout=10)
        if res.status_code == 200 and res.json().get("data"):
            return res.json()["data"][0]
    except Exception as e:
        print(f"❌ API 실패: {e}")
    return {}

# 🔽 경로 설정
input_csv = "data/fire_archive_J1V-C2_618777.csv"  # 네가 준 원본 데이터
output_csv = "data/merged/fire_weather_merged.csv"

# CSV 불러오기
df = pd.read_csv(input_csv)
df = df.drop_duplicates().dropna()
df = df.head(30)  # 테스트 용량 제한, 실제는 전체 써도 됨

print("🌤️ 기상 정보 병합 중...")
records = []

for _, row in tqdm(df.iterrows(), total=len(df)):
    lat, lon, date = row['latitude'], row['longitude'], row['acq_date']
    weather = get_meteostat(lat, lon, date)
    merged = row.to_dict()
    for k in ['temp', 'prcp', 'wspd', 'wdir', 'rhum', 'dwpt']:
        merged[k] = weather.get(k)
    records.append(merged)
    time.sleep(0.2)  # 너무 빠르면 API 차단됨

merged_df = pd.DataFrame(records)
merged_df.to_csv(output_csv, index=False)
print("✅ 병합 완료:", output_csv)
