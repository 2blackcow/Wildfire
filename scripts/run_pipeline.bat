@echo off
echo Step 1: 데이터 전처리 및 격자 변환
python scripts/build_and_grid_train_data.py

echo Step 2: 피처 인코딩 및 정리
python scripts/prepare_grid_train_data.py

echo Step 3: 날짜별 예측 및 결과 저장
python scripts/train_predict_grid_korea.py

echo.
echo ✅ 전체 파이프라인 완료!
pause
