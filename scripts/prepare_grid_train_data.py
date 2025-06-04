# prepare_grid_train_data.py

import pandas as pd
from sklearn.preprocessing import LabelEncoder

df = pd.read_csv("data/train_fire_data_grid.csv")

# 격자 ID 범주 → 숫자로 변환
le = LabelEncoder()
df['grid_id_encoded'] = le.fit_transform(df['grid_id'])

# 특성 선택
features = ['grid_id_encoded', 'temp', 'wspd', 'rhum', 'brightness', 'frp', 'confidence']
X = df[features]
y = df['fire_occurred']

# 데이터셋 저장
train_df = X.copy()
train_df['fire_occurred'] = y
train_df.to_csv("data/grid_encoded_train_data.csv", index=False)

print("✅ 격자 데이터 전처리 완료. 파일 저장됨: data/grid_encoded_train_data.csv")
