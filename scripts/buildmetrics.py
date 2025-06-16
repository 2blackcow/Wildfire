import pandas as pd
import json
from tqdm import tqdm
from datetime import datetime, timedelta
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    roc_auc_score, 
    classification_report, 
    accuracy_score, 
    precision_score, 
    recall_score, 
    f1_score
)

# 1. 아래만 맞게 조정하면 됨!
REGION = "la"   # or "la"
ENCODED = f"data/grid_encoded_train_data_{REGION}.csv" if REGION == "korea" else "data/grid_encoded_train_data.csv"
RAW = f"data/train_fire_data_grid_{REGION}.csv" if REGION == "korea" else "data/train_fire_data_grid.csv"
PREDICT_JSON_DIR = "public/test/korea" if REGION == "korea" else "public/test/la"
CSV_METRICS_PATH = f"public/{REGION}_metrics.csv"

df_original = pd.read_csv(RAW)
df_encoded = pd.read_csv(ENCODED)
df_original["acq_date"] = pd.to_datetime(df_original["date"])
df_encoded["acq_date"] = pd.to_datetime(df_original["date"])

features = ["grid_id_encoded", "temp", "wspd", "rhum", "brightness", "frp", "confidence"]

# 날짜 셋팅
if REGION == "la":
    date_list = [
        "2025-01-08","2025-01-09","2025-01-10","2025-01-13",
        "2025-01-14","2025-01-16","2025-01-18","2025-01-20"
    ]
else:
    # 자동 추출
    date_list = sorted(df_original["acq_date"].dt.strftime("%Y-%m-%d").unique())
    start_date = datetime(2024, 10, 1)
    end_date = datetime(2025, 4, 1)
    date_list = [d for d in date_list if start_date <= datetime.strptime(d, "%Y-%m-%d") <= end_date]

DATE_FMT = "%Y-%m-%d"

all_metrics = []

for TARGET_DATE in date_list:
    print(f"\n🚀 [{TARGET_DATE}] 예측 시작!")
    cutoff = (datetime.strptime(TARGET_DATE, DATE_FMT) - timedelta(days=1)).strftime(DATE_FMT)
    train_df = df_encoded[df_encoded["acq_date"] <= cutoff].copy()
    test_df = df_encoded[df_encoded["acq_date"] == TARGET_DATE].copy()

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
        y_pred = (probas > 0.5).astype(int)
        
        # 평가 지표 계산
        metrics = {
            "region": REGION,
            "date": TARGET_DATE,
            "accuracy": accuracy_score(y_test, y_pred) if y_test is not None else None,
            "precision": precision_score(y_test, y_pred, zero_division=0) if y_test is not None else None,
            "recall": recall_score(y_test, y_pred, zero_division=0) if y_test is not None else None,
            "f1_score": f1_score(y_test, y_pred, zero_division=0) if y_test is not None else None,
            "roc_auc": roc_auc_score(y_test, probas) if y_test is not None else None,
            "support": len(y_test) if y_test is not None else None
        }
        all_metrics.append(metrics)

        # 예측결과 json 저장 (기존과 동일)
        X_test = X_test.copy()
        X_test["probability"] = probas
        X_test["grid_id"] = df_original.loc[X_test.index, "grid_id"].values
        results = [
            {"grid_id": row["grid_id"], "probability": round(row["probability"], 2)}
            for _, row in tqdm(X_test.iterrows(), total=len(X_test), desc=f"[{TARGET_DATE}] JSON 변환 중")
        ]
        date_tag = TARGET_DATE.replace("-", "")
        if REGION == "korea":
            save_path = f"{PREDICT_JSON_DIR}/predicted_grid_fire_points_{REGION}_{date_tag}_test_korea.json"
        else:
            save_path = f"{PREDICT_JSON_DIR}/predicted_grid_fire_points_{date_tag}_test_la.json"
        with open(save_path, "w") as f:
            json.dump(results, f, indent=2)
        print(f"✅ [{TARGET_DATE}] 예측 결과 저장 완료 → {save_path}")
    else:
        print("❌ fire_occurred 컬럼이 없습니다! (학습 불가)")
        continue

# ==============================
# CSV 저장 + 평균 한 줄 추가
# ==============================
if all_metrics:
    df_metrics = pd.DataFrame(all_metrics)
    # 평균 한 줄 추가 (support 가중 평균)
    avg_row = {
        "region": REGION,
        "date": "AVERAGE",
        "accuracy": (df_metrics["accuracy"] * df_metrics["support"]).sum() / df_metrics["support"].sum(),
        "precision": (df_metrics["precision"] * df_metrics["support"]).sum() / df_metrics["support"].sum(),
        "recall": (df_metrics["recall"] * df_metrics["support"]).sum() / df_metrics["support"].sum(),
        "f1_score": (df_metrics["f1_score"] * df_metrics["support"]).sum() / df_metrics["support"].sum(),
        "roc_auc": (df_metrics["roc_auc"] * df_metrics["support"]).sum() / df_metrics["support"].sum(),
        "support": df_metrics["support"].sum()
    }
    df_metrics = pd.concat([df_metrics, pd.DataFrame([avg_row])], ignore_index=True)
    df_metrics.to_csv(CSV_METRICS_PATH, index=False, float_format="%.4f")
    print(f"\n📊 지역별 날짜별 평가 지표 → {CSV_METRICS_PATH} 저장됨!")
    print(df_metrics)
else:
    print("⚠️ 평가할 데이터가 없습니다.")

