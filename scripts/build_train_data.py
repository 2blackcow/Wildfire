import pandas as pd
import numpy as np
import os

INPUT = "data/merged/fire_weather_merged.csv"
OUTPUT = "data/train_fire_data.csv"

df = pd.read_csv(INPUT)

# NaN 기본값 채우기
df['temp'] = df['temp'].fillna(25)
df['wspd'] = df['wspd'].fillna(3.0)
df['rhum'] = df['rhum'].fillna(50)

df['fire_occurred'] = 1

sample_n = min(30, len(df))
if sample_n == 0:
    raise ValueError("❌ usable 데이터가 너무 적음")

no_fire = df.sample(n=sample_n).copy()
no_fire['latitude'] += np.random.uniform(-0.3, 0.3, len(no_fire))
no_fire['longitude'] += np.random.uniform(-0.3, 0.3, len(no_fire))
no_fire['fire_occurred'] = 0

final_df = pd.concat([df, no_fire], ignore_index=True)
final_df.to_csv(OUTPUT, index=False)
print(f"✅ 학습용 데이터셋 저장 완료: {OUTPUT} (총 {len(final_df)}개)")
