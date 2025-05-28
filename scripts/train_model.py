import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, confusion_matrix
import json
import shutil
import os

df = pd.read_csv("data/train_fire_data.csv")

# 🔥 문자형 confidence → 숫자로 변환
if df['confidence'].dtype == object:
    df['confidence'] = df['confidence'].map({'l': 0, 'n': 1, 'h': 2}).fillna(1)

# ✅ 컬럼 이름 정확히
features = ['temp', 'wspd', 'rhum', 'brightness', 'frp', 'confidence']
X = df[features]
y = df['fire_occurred']

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

model = RandomForestClassifier()
model.fit(X_train, y_train)

y_pred = model.predict(X_test)
probas = model.predict_proba(X_test)[:,1]

print("✅ 정확도:", accuracy_score(y_test, y_pred))
print("✅ 혼동 행렬:\n", confusion_matrix(y_test, y_pred))

X_test = X_test.copy()
X_test['probability'] = probas
X_test['latitude'] = df.iloc[X_test.index]['latitude']
X_test['longitude'] = df.iloc[X_test.index]['longitude']

res = []
for _, row in X_test.iterrows():
    res.append({
        "lat": float(row['latitude']),
        "lon": float(row['longitude']),
        "probability": round(row['probability'], 2)
    })

with open("data/predicted_fire_points.json", "w") as f:
    json.dump(res, f, indent=2)
shutil.copy("data/predicted_fire_points.json", "public/predicted_fire_points.json")

print("✅ 예측 결과 저장 완료!")
