import pandas as pd
import json
from tqdm import tqdm
from datetime import datetime, timedelta
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import roc_auc_score, classification_report

REGION = "korea"
ENCODED = f"data/grid_encoded_train_data_{REGION}.csv"
RAW = f"data/train_fire_data_grid_{REGION}.csv"

df_original = pd.read_csv(RAW)
df_encoded = pd.read_csv(ENCODED)
df_original["acq_date"] = pd.to_datetime(df_original["date"])
df_encoded["acq_date"] = pd.to_datetime(df_original["date"])

features = ["grid_id_encoded", "temp", "wspd", "rhum", "brightness", "frp", "confidence"]

# 날짜 자동 추출 및 필터링
date_list = sorted(df_original["acq_date"].dt.strftime("%Y-%m-%d").unique())
start_date = datetime(2024, 10, 1)
end_date = datetime(2025, 4, 1)
date_list = [d for d in date_list if start_date <= datetime.strptime(d, "%Y-%m-%d") <= end_date]

DATE_FMT = "%Y-%m-%d"

for TARGET_DATE in date_list:
    print(f"\n🚀 [{TARGET_DATE}] 예측 시작!")

    cutoff = (datetime.strptime(TARGET_DATE, DATE_FMT) - timedelta(days=1)).strftime(DATE_FMT)

    # 학습 데이터 (D-1까지), 테스트 데이터 (D일) 명확히 분리
    train_df = df_encoded[df_encoded["acq_date"] <= cutoff].copy()
    test_df = df_encoded[df_encoded["acq_date"] == TARGET_DATE].copy()

    # 📌 데이터 누수 방지 체크 추가 (매우 중요)
    print(f"학습 데이터 최대 날짜: {train_df['acq_date'].max()}, 예측 날짜: {test_df['acq_date'].unique()}")

    X_train = train_df[features].dropna()
    y_train = train_df.loc[X_train.index, "fire_occurred"] if "fire_occurred" in train_df.columns else None
    X_test = test_df[features].dropna()
    y_test = test_df.loc[X_test.index, "fire_occurred"] if "fire_occurred" in test_df.columns else None

    if X_test.empty or (y_train is not None and y_train.empty):
        print(f"😅 {TARGET_DATE} 학습 또는 테스트 데이터 없음! 스킵합니다.")
        continue

    model = RandomForestClassifier(random_state=42)
    if y_train is not None:
        model.fit(X_train, y_train)
        probas = model.predict_proba(X_test)[:, 1]

        # 📌 특성 중요도 출력 (과적합 방지용 확인)
        feature_importances = model.feature_importances_
        print("Feature Importances:")
        for f, imp in zip(features, feature_importances):
            print(f" - {f}: {imp:.4f}")

        # 📌 추가 평가 메트릭 출력 (ROC-AUC, Classification Report)
        if y_test is not None:
            auc_score = roc_auc_score(y_test, probas)
            print(f"ROC-AUC Score: {auc_score:.4f}")
            print("Classification Report:")
            print(classification_report(y_test, probas > 0.5))
    else:
        print("❌ fire_occurred 컬럼이 없습니다! (학습 불가)")
        continue

    X_test = X_test.copy()
    X_test["probability"] = probas
    X_test["grid_id"] = df_original.loc[X_test.index, "grid_id"].values

    results = [
        {"grid_id": row["grid_id"], "probability": round(row["probability"], 2)}
        for _, row in tqdm(X_test.iterrows(), total=len(X_test), desc=f"[{TARGET_DATE}] JSON 변환 중")
    ]

    region_tag = REGION
    date_tag = TARGET_DATE.replace("-", "")
    save_path = f"public/test/predicted_grid_fire_points_{region_tag}_{date_tag}_test.json"

    with open(save_path, "w") as f:
        json.dump(results, f, indent=2)

    print(f"✅ [{TARGET_DATE}] 예측 결과 저장 완료 → {save_path}")
