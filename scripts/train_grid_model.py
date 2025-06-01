import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix
import json
import shutil
from tqdm import tqdm

# 격자 인코딩 데이터 로딩
df_encoded = pd.read_csv("data/grid_encoded_train_data.csv")
# 원본 격자 ID 데이터 로딩
df_original = pd.read_csv("data/train_fire_data_grid.csv")

features = ['grid_id_encoded', 'temp', 'wspd', 'rhum', 'brightness', 'frp', 'confidence']
X = df_encoded[features]
y = df_encoded['fire_occurred']

# 데이터 분할
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# 결측값 제거
X_train = X_train.dropna()
y_train = y_train.loc[X_train.index]

X_test = X_test.dropna()
y_test = y_test.loc[X_test.index]

# 문자형 confidence 숫자로 변환
if X_train['confidence'].dtype == object:
    confidence_map = {'l': 0, 'n': 1, 'h': 2}
    X_train['confidence'] = X_train['confidence'].map(confidence_map).fillna(1)
    X_test['confidence'] = X_test['confidence'].map(confidence_map).fillna(1)

# 모델 학습
model = RandomForestClassifier()
model.fit(X_train, y_train)

# 예측
y_pred = model.predict(X_test)
probas = model.predict_proba(X_test)[:, 1]

# 평가 지표 출력
print("✅ 정확도:", accuracy_score(y_test, y_pred))
print("✅ 정밀도 (Precision):", precision_score(y_test, y_pred))
print("✅ 재현율 (Recall):", recall_score(y_test, y_pred))
print("✅ F1 점수:", f1_score(y_test, y_pred))
print("✅ 혼동 행렬:\n", confusion_matrix(y_test, y_pred))

# 결과 JSON 생성
X_test = X_test.copy()
X_test['probability'] = probas

# 원본 grid_id를 JSON에 저장
X_test['grid_id'] = df_original.iloc[X_test.index]['grid_id'].values

res = []
for _, row in tqdm(X_test.iterrows(), total=len(X_test), desc="🚀 JSON 변환 중"):
    res.append({
        "grid_id": row['grid_id'],  # 문자열 원본 grid_id
        "probability": round(row['probability'], 2)
    })

with open("data/predicted_grid_fire_points.json", "w") as f:
    json.dump(res, f, indent=2)

shutil.copy("data/predicted_grid_fire_points.json", "public/predicted_grid_fire_points.json")

print("✅ 격자 기반 예측 결과 저장 완료 🔥")