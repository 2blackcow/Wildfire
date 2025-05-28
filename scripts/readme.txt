⚙️ 실행 스크립트 & 순서
1️⃣ 화재 + 기상 데이터 병합
RapidAPI를 이용하여 위경도+날짜 기반 날씨 정보 수집

python scripts/merge_firms_weather.py
📌 결과: data/merged/fire_weather_merged.csv 생성

2️⃣ 학습용 데이터 생성
라벨링(fire_occurred) 추가 및 화재 없는 샘플 생성

python scripts/build_train_data.py
📌 결과: data/train_fire_data.csv 생성

3️⃣ 머신러닝 예측 모델 학습 & 결과 저장
RandomForestClassifier로 예측 및 시각화용 JSON 생성

python scripts/train_model.py
📌 결과:

data/predicted_fire_points.json

public/predicted_fire_points.json 자동 복사