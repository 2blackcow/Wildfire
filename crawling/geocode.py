import pandas as pd
import requests
import time
import os
from dotenv import load_dotenv

# .env 로드
load_dotenv()

# Kakao API 키 불러오기
KAKAO_API_KEY = "KakaoAK " + os.getenv("KAKAO_REST_KEY")

# 파일 경로
INPUT = "wildfire_all_2024_10_to_2025_04.csv"
OUTPUT = "wildfire_geocoded_2024_10_to_2025_04.csv"

# CSV 불러오기 및 컬럼 추가
df = pd.read_csv(INPUT)
df["위도"] = None
df["경도"] = None

# 주소 → 위경도 함수
def get_coords(address):
    url = "https://dapi.kakao.com/v2/local/search/address.json"
    headers = {"Authorization": KAKAO_API_KEY}
    params = {"query": address}
    try:
        res = requests.get(url, headers=headers, params=params, timeout=5)
        result = res.json()
        # print(f"[DEBUG] {address} → {result}")  # 디버깅 시 활성화

        if result.get("documents"):
            x = result["documents"][0]["x"]
            y = result["documents"][0]["y"]
            return float(y), float(x)
    except Exception as e:
        print(f"[ERROR] {address} → {e}")
    return None, None

# 주소별 변환
for i in range(len(df)):
    addr = df.loc[i, "주소"]
    lat, lon = get_coords(addr)
    df.loc[i, "위도"] = lat
    df.loc[i, "경도"] = lon
    print(f"[{i+1}/{len(df)}] {addr} → ({lat}, {lon})")
    time.sleep(0.3)

# 저장
df.to_csv(OUTPUT, index=False, encoding="utf-8-sig")
print(f"\n✅ Geocoding 완료: {OUTPUT}")
