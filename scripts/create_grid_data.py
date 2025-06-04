# create_grid_data.py

import pandas as pd
import math

# 격자 설정 (LA 지역 기준)
min_lat, min_lon = 33.5, -119.0
cell_size = 0.05  # 약 5km 단위

# 격자 ID 할당 함수
def assign_grid_id(lat, lon, min_lat, min_lon, cell_size):
    lat_idx = math.floor((lat - min_lat) / cell_size)
    lon_idx = math.floor((lon - min_lon) / cell_size)
    return f"l_{lat_idx}_{lon_idx}"

# 데이터 불러오기
df = pd.read_csv("data/train_fire_data.csv")

# 격자 ID 추가
df["grid_id"] = df.apply(lambda row: assign_grid_id(row["latitude"], row["longitude"], min_lat, min_lon, cell_size), axis=1)

# 저장
df.to_csv("data/train_fire_data_grid.csv", index=False)

print("✅ 격자 ID 할당 완료. 파일 저장됨: data/train_fire_data_grid.csv")
