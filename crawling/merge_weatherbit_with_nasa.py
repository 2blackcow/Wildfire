import pandas as pd
import numpy as np
from datetime import timedelta
from sklearn.neighbors import NearestNeighbors

# 🔹 경로 설정
weather_path = "train_fire_data_with_weatherbit.csv"
nasa_path = "fire(2024-10-01~2025-04-01).csv"
output_path = "train_fire_data_precise_merged.csv"

print("📁 CSV 불러오는 중...")
weather_df = pd.read_csv(weather_path)
nasa_df = pd.read_csv(nasa_path)

# 🔹 날짜 통일
weather_df["acq_date"] = pd.to_datetime(weather_df["acq_date"]).dt.date
nasa_df["acq_date"] = pd.to_datetime(nasa_df["acq_date"]).dt.date

# 🔁 결과 저장용 리스트
results = []

print("🧠 날짜 ±3일 + 위치 최근접 NASA 데이터 병합 중...")
for i, row in weather_df.iterrows():
    lat, lon = row["위도"], row["경도"]
    date = row["acq_date"]

    # 1. NASA에서 ±3일 내 데이터 필터링
    date_filtered = nasa_df[
        (nasa_df["acq_date"] >= date - timedelta(days=3)) &
        (nasa_df["acq_date"] <= date + timedelta(days=3))
    ]

    if len(date_filtered) == 0:
        # 해당 날짜 범위 내 NASA 데이터 없음
        row["brightness"] = np.nan
        row["frp"] = np.nan
        row["confidence"] = np.nan
    else:
        # 2. 거리 계산 후 가장 가까운 지점 선택
        coords = date_filtered[["latitude", "longitude"]].to_numpy()
        dist_sq = np.sum((coords - np.array([lat, lon]))**2, axis=1)
        nearest_idx = np.argmin(dist_sq)
        nearest_row = date_filtered.iloc[nearest_idx]

        row["brightness"] = nearest_row["brightness"]
        row["frp"] = nearest_row["frp"]
        row["confidence"] = nearest_row["confidence"]

    results.append(row)

# 🔄 결과 저장
final_df = pd.DataFrame(results)
final_df.to_csv(output_path, index=False)

# ✅ 결과 출력
matched = final_df["brightness"].notna().sum()
print(f"✅ 병합 완료: {output_path}")
print(f"🔍 NASA 데이터 병합 성공: {matched}건 / {len(final_df)}건")
