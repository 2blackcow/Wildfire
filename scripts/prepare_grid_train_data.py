# prepare_grid_train_data.py
import pandas as pd
from sklearn.preprocessing import LabelEncoder

# region에 따라 파일명 변경
REGION = "korea"  # "la" or "korea"
GRID_CSV = f"data/train_fire_data_grid_{REGION}.csv" if REGION == "korea" else "data/train_fire_data_grid.csv"
OUTPUT = f"data/grid_encoded_train_data_{REGION}.csv"

df = pd.read_csv(GRID_CSV)
le = LabelEncoder()
df['grid_id_encoded'] = le.fit_transform(df['grid_id'])

conf_map = {"l": 0, "n": 1, "h": 2}
df['confidence'] = df['confidence'].map(conf_map).fillna(1)

features = ['grid_id_encoded', 'temp', 'wspd', 'rhum', 'brightness', 'frp', 'confidence']
X = df[features]
if "fire_occurred" in df.columns:
    y = df['fire_occurred']
    train_df = X.copy()
    train_df['fire_occurred'] = y
else:
    train_df = X.copy()  # 테스트용 예측만

train_df.to_csv(OUTPUT, index=False)
print(f"✅ 격자 데이터 전처리 완료: {OUTPUT}")
