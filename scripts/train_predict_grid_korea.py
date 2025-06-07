# train_predict_grid_korea.py
import pandas as pd
import json
from tqdm import tqdm
from datetime import datetime, timedelta
from sklearn.ensemble import RandomForestClassifier

REGION = "korea"
ENCODED = f"data/grid_encoded_train_data_{REGION}.csv"
RAW = f"data/train_fire_data_grid_{REGION}.csv"

df_original = pd.read_csv(RAW)
df_encoded = pd.read_csv(ENCODED)
df_original["acq_date"] = pd.to_datetime(df_original["date"])
df_encoded["acq_date"] = pd.to_datetime(df_original["date"])

features = ["grid_id_encoded", "temp", "wspd", "rhum", "brightness", "frp", "confidence"]

# 날짜 자동 추출
date_list = sorted(df_original["acq_date"].dt.strftime("%Y-%m-%d").unique())
start_date = datetime(2024, 10, 1)
end_date = datetime(2025, 4, 1)
date_list = [d for d in date_list if start_date <= datetime.strptime(d, "%Y-%m-%d") <= end_date]

DATE_FMT = "%Y-%m-%d"

for TARGET_DATE in date_list:
    print(f"\n🚀 [{TARGET_DATE}] 예측 시작!")
    cutoff = (datetime.strptime(TARGET_DATE, DATE_FMT) - timedelta(days=1)).strftime(DATE_FMT)
    train_df = df_encoded[df_encoded["acq_date"] <= cutoff].copy()
    test_df = df_encoded[df_encoded["acq_date"] == TARGET_DATE].copy()
    X_train = train_df[features].dropna()
    y_train = train_df.loc[X_train.index, "fire_occurred"] if "fire_occurred" in train_df.columns else None
    X_test = test_df[features].dropna()

    if X_test.empty or (y_train is not None and y_train.empty):
        print(f"😅 {TARGET_DATE} 학습/테스트 데이터 없음! (스킵)")
        continue

    model = RandomForestClassifier()
    if y_train is not None:
        model.fit(X_train, y_train)
        probas = model.predict_proba(X_test)[:, 1]
    else:
        print("❌ fire_occurred 컬럼 없음!")
        continue

    X_test = X_test.copy()
    X_test["probability"] = probas
    X_test["grid_id"] = df_original.loc[X_test.index, "grid_id"].values

    results = [
        {"grid_id": row["grid_id"], "probability": round(row["probability"], 2)}
        for _, row in tqdm(X_test.iterrows(), total=len(X_test), desc=f"[{TARGET_DATE}] JSON 변환 중")
    ]
    region_tag = REGION  # "la" 또는 "korea"
    date_tag = TARGET_DATE.replace("-", "")
    save_path = f"public/predicted/korea/predicted_grid_fire_points_{region_tag}_{date_tag}.json"

    with open(save_path, "w") as f:
        json.dump(results, f, indent=2)

    print(f"✅ [{TARGET_DATE}] 예측 결과 저장 완료 → {save_path}")
