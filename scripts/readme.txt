📁 주요 코드 및 구조

1️⃣ create_grid_data.py
역할:

기존의 화재 데이터(train_fire_data.csv)에 격자(Grid) ID를 부여해서, 각 지점이 어느 격자(셀)에 속하는지 표시함.

위경도(좌표) → **격자 ID(문자열, 예: l_30_52)**로 변환해서, 이후 모델이 공간적으로 해석할 수 있게 만듦.

주요 로직:

위경도와 min_lat, min_lon, cell_size로 격자 인덱스 계산

각 row마다 grid_id 컬럼 추가

저장: data/train_fire_data_grid.csv

2️⃣ prepare_grid_train_data.py
역할:

방금 만든 grid_id(문자열, l_30_52 등)를 머신러닝에 입력할 수 있게 LabelEncoder로 숫자화

이 숫자 격자 인덱스(grid_id_encoded)와 기상/화재 특성들을 합쳐 최종적으로 모델 학습에 쓸 학습용 데이터셋 생성

주요 로직:

train_fire_data_grid.csv 로드 → grid_id 컬럼을 숫자 인덱스(grid_id_encoded)로 변환

필요한 특성만 추출 (temp, wspd, rhum, brightness, frp, confidence 등)

레이블(fire_occurred)과 합쳐 최종 학습셋 data/grid_encoded_train_data.csv 저장

3️⃣ train_grid_model.py
역할:

위에서 만든 격자 기반(숫자 인덱스) 학습 데이터로 랜덤 포레스트 모델 학습

예측 결과(격자별 산불발생 확률)를 JSON 파일로 만들어, 시각화(세슘)에 바로 쓸 수 있게 내보냄

✅ 주요 로직:

grid_encoded_train_data.csv에서 X(입력), y(라벨) 분리

훈련/테스트 셋 분할 후 RandomForest 학습

평가 지표(정확도, 정밀도 등) 출력

각 테스트셋에 대해 예측 확률을 저장해서 data/predicted_grid_fire_points.json로 저장

이때, **원본 문자열 격자 ID(grid_id)**로 다시 복구해서 저장함 → 프론트엔드에서 공간 매핑 쉬움

✅ 전체 흐름 요약

build_train_data.py (기초 데이터+API 합치기)
→ train_fire_data.csv

create_grid_data.py (위경도 → 격자 ID 변환)
→ train_fire_data_grid.csv

prepare_grid_train_data.py (격자 ID를 숫자로, 특성만 추출해 최종 학습셋 준비)
→ grid_encoded_train_data.csv

train_grid_model.py (격자별로 산불발생 예측 모델 학습+결과 저장)
→ predicted_grid_fire_points.json → 시각화 사용

⚙️ 실행 방법

1️⃣ 패키지 설치
pip install pandas numpy scikit-learn tqdm requests python-dotenv

2️⃣ 격자 기반 학습 데이터 생성
python scripts/prepare_grid_train_data.py

결과: data/grid_encoded_train_data.csv 생성

3️⃣ 머신러닝 예측 모델 학습 & 결과 저장
python scripts/train_grid_model.py

결과:

public/predicted/predicted_grid_fire_points.json 자동 복사

4️⃣ 프론트엔드(3D 시각화) 서버 실행
vercel dev