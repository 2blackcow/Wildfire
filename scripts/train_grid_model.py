import pandas as pd
import json
import shutil
from tqdm import tqdm
from datetime import datetime, timedelta
from sklearn.ensemble import RandomForestClassifier

# ====== 날짜 리스트 (여기서 예측할 날짜들만 골라!)
date_list = [
    "2025-01-08",
    "2025-01-09",
    "2025-01-10",
    "2025-01-13",
    "2025-01-14",
    "2025-01-16",
    "2025-01-18",
    "2025-01-20",
]

DATE_FMT = "%Y-%m-%d"

# ====== 데이터 로드 (파일명은 네 기존 프로젝트에 맞게 고쳐!)
df_original = pd.read_csv("data/train_fire_data_grid.csv")
df_encoded = pd.read_csv("data/grid_encoded_train_data.csv")

# 날짜 정보 붙이기
df_original["acq_date"] = pd.to_datetime(df_original["date"])
df_encoded["acq_date"] = pd.to_datetime(df_original["date"])  # 인덱스 기준으로 붙임

conf_map = {"l": 0, "n": 1, "h": 2}
df_encoded["confidence"] = df_encoded["confidence"].map(conf_map).fillna(1)

features = ["grid_id_encoded", "temp", "wspd", "rhum", "brightness", "frp", "confidence"]

for TARGET_DATE in date_list:
    print(f"\n🚀 [{TARGET_DATE}] 예측 시작!")

    cutoff = (datetime.strptime(TARGET_DATE, DATE_FMT) - timedelta(days=1)).strftime(DATE_FMT)

    # 날짜별 train, test 분리
    train_df = df_encoded[df_encoded["acq_date"] <= cutoff].copy()
    test_df = df_encoded[df_encoded["acq_date"] == TARGET_DATE].copy()
    X_train = train_df[features].dropna()
    y_train = train_df.loc[X_train.index, "fire_occurred"]
    X_test = test_df[features].dropna()

    if X_test.empty:
        print(f"😅 {TARGET_DATE} 테스트 데이터 없음! (스킵)")
        continue

    # 학습 & 예측
    model = RandomForestClassifier()
    model.fit(X_train, y_train)
    probas = model.predict_proba(X_test)[:, 1]

    # 결과 JSON 저장
    X_test = X_test.copy()
    X_test["probability"] = probas
    X_test["grid_id"] = df_original.loc[X_test.index, "grid_id"].values

    results = [
        {"grid_id": row["grid_id"], "probability": round(row["probability"], 2)}
        for _, row in tqdm(X_test.iterrows(), total=len(X_test), desc=f"[{TARGET_DATE}] JSON 변환 중")
    ]

    date_tag = TARGET_DATE.replace("-", "")
    save_path = f"public/predicted/predicted_grid_fire_points_{date_tag}.json"

    with open(save_path, "w") as f:
        json.dump(results, f, indent=2)

    print(f"✅ [{TARGET_DATE}] 예측 결과 저장 완료 → {save_path}")
