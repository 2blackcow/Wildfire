📁 주요 코드 및 구조
1. prepare_grid_train_data.py
NASA 화재 데이터(위경도, 밝기 등)와 기상 API(온도, 풍속, 습도 등)를 결합

각 샘플의 위경도를 **격자 인덱스(grid_id)**로 변환, 격자 단위로 라벨링

최종 학습용 CSV(data/grid_encoded_train_data.csv) 생성

→ 이후 이 파일이 예측 모델의 입력 데이터로 사용됨

2. train_grid_model.py
위에서 생성한 격자 기반 학습 데이터로
머신러닝(RandomForest 등) 예측 모델 학습

격자별 예측 결과(data/predicted_grid_fire_points.json)로 저장
(public/predicted_grid_fire_points.json에도 복사)

3. build_train_data.py
NASA 화재 데이터(위경도, 밝기 등)와 기상 API(온도, 풍속, 습도 등)를 결합하여
격자 정보(grid_id)를 추가한 학습용 CSV(data/grid_encoded_train_data.csv) 생성

⚙️ 실행 방법
1️⃣ 패키지 설치
pip install pandas numpy scikit-learn tqdm requests python-dotenv

2️⃣ 격자 기반 학습 데이터 생성
python scripts/prepare_grid_train_data.py

결과: data/grid_encoded_train_data.csv 생성

3️⃣ 머신러닝 예측 모델 학습 & 결과 저장
python scripts/train_grid_model.py

결과:
data/predicted_grid_fire_points.json 생성

public/predicted_grid_fire_points.json 자동 복사

4️⃣ 프론트엔드(3D 시각화) 서버 실행
vercel dev