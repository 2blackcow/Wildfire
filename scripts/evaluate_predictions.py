import pandas as pd
import json
from haversine import haversine
import shutil

# ✅ 누락된 함수 추가!
def is_hit(pred_lat, pred_lon, fire_locations, threshold_km=2):
    for lat, lon in fire_locations:
        if haversine((pred_lat, pred_lon), (lat, lon)) <= threshold_km:
            return True
    return False

# 🔥 실제 화재 지점 로딩
fire_df = pd.read_csv("data/train_fire_data.csv")
true_fires = fire_df[fire_df["fire_occurred"] == 1][["latitude", "longitude"]].values.tolist()

# 🔍 예측 결과 로딩
with open("data/predicted_fire_points.json", "r") as f:
    preds = json.load(f)

# 🎯 거리 기반 평가 (2km 이내면 hit)
updated_preds = []
hit_count = 0
for pt in preds:
    hit = is_hit(pt["lat"], pt["lon"], true_fires, threshold_km=2)
    pt["hit"] = hit
    if hit:
        hit_count += 1
    updated_preds.append(pt)

# 💾 저장
with open("data/predicted_fire_points_eval.json", "w") as f:
    json.dump(updated_preds, f, indent=2)

shutil.copy("data/predicted_fire_points_eval.json", "public/predicted_fire_points.json")

# 🧾 결과 요약
print(f"✅ 총 예측 지점: {len(updated_preds)}")
print(f"✅ 실제 화재 근접 예측 (Hit): {hit_count}")
print(f"✅ Hit 비율: {hit_count / len(updated_preds):.2%}")
