# build_and_grid_train_data.py
import os
import pandas as pd
import numpy as np
import math
from datetime import datetime
from tqdm import tqdm

# === CONFIG ===
REGION = "korea"  # "la" 또는 "korea"만 바꿔주면 됨

if REGION == "la":
    RAW_FILE = "data/fire_archive_J1V-C2_618777.csv"
    GRID_CSV = "data/train_fire_data_grid.csv"
    MIN_LAT, MIN_LON = 33.5, -119.0
    CELL_SIZE = 0.05
    DATE_FIELD = "acq_date"
    LAT_FIELD, LON_FIELD = "latitude", "longitude"
elif REGION == "korea":
    RAW_FILE = "public/data/korea_fire_enhanced_2024_2025.json"
    GRID_CSV = "data/train_fire_data_grid_korea.csv"
    MIN_LAT, MIN_LON = 34.0, 126.0
    CELL_SIZE = 0.05
    DATE_FIELD = "frfr_sttmn_dt"
    LAT_FIELD, LON_FIELD = "frfr_lctn_ycrd", "frfr_lctn_xcrd"
else:
    raise ValueError("REGION은 'la' 또는 'korea'만 지원!")

def assign_grid_id(lat, lon, min_lat, min_lon, cell_size):
    lat_idx = math.floor((lat - min_lat) / cell_size)
    lon_idx = math.floor((lon - min_lon) / cell_size)
    return f"l_{lat_idx}_{lon_idx}"

# --- 파일 로드 및 전처리 ---
if RAW_FILE.endswith(".csv"):
    df = pd.read_csv(RAW_FILE)
elif RAW_FILE.endswith(".json"):
    df = pd.read_json(RAW_FILE, encoding="utf-8")
else:
    raise ValueError("지원하지 않는 파일 형식!")

if REGION == "korea":
    df = df[df[LAT_FIELD].notnull() & df[LON_FIELD].notnull()]
    df["latitude"] = df[LAT_FIELD].astype(float)
    df["longitude"] = df[LON_FIELD].astype(float)
    # ✅ 항상 문자열 변환 후 .str 사용!
    df["date"] = pd.to_datetime(df[DATE_FIELD].astype(str).str[:10], errors="coerce")
    if "confidence" in df:
        df["confidence"] = df["confidence"].fillna("n")
else:
    df["date"] = pd.to_datetime(df[DATE_FIELD])


# --- 격자 ID 생성
df["grid_id"] = df.apply(lambda row: assign_grid_id(
    row["latitude"], row["longitude"], MIN_LAT, MIN_LON, CELL_SIZE
), axis=1)

# --- fire_occurred 라벨 생성 ---
if REGION == "korea":
    # 실제 화재 데이터: 라벨 1
    fire_df = df.copy()
    fire_df["fire_occurred"] = 1

    # 비화재 샘플 생성 (랜덤 위치/약간 시프트)
    n = min(100, len(fire_df))  # 샘플 개수 조정 가능
    no_fire = fire_df.sample(n=n).copy()
    no_fire["latitude"] += np.random.uniform(-0.2, 0.2, len(no_fire))
    no_fire["longitude"] += np.random.uniform(-0.2, 0.2, len(no_fire))
    no_fire["fire_occurred"] = 0

    df_out = pd.concat([fire_df, no_fire], ignore_index=True)
else:
    # LA는 이미 라벨링되어 있다고 가정 (코드 생략해도 됨)
    df_out = df.copy()

# --- 컬럼 보존 및 정리
FEATURES = ["latitude", "longitude", "date", "temp", "wspd", "rhum", "brightness", "frp", "confidence", "grid_id", "fire_occurred"]
for col in FEATURES:
    if col not in df_out.columns:
        df_out[col] = np.nan

df_out = df_out[FEATURES]
df_out.to_csv(GRID_CSV, index=False)
print(f"✅ 격자 변환 및 fire_occurred 라벨 생성 완료: {GRID_CSV} ({len(df_out)}개)")

