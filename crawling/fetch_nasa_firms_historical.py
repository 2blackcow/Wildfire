import os
import requests
import csv
import json
import time
from dotenv import load_dotenv
from datetime import datetime, timedelta

def load_existing_data(path):
    """기존 JSON 파일 로드"""
    if not os.path.exists(path):
        return []
    with open(path, "r", encoding="utf-8") as f:
        try:
            return json.load(f)
        except:
            return []

def fetch_firms_historical_range():
    """2024-10-01부터 2025-04-01까지 NASA FIRMS 데이터 수집"""
    
    # 환경 변수 로드
    dotenv_path = os.path.abspath(os.path.join(__file__, "..", "..", ".env"))
    load_dotenv(dotenv_path)
    map_key = os.getenv("FIRMS_KEY") or "d4c10c572f34e93458cca9cd34424991"

    if not map_key:
        print("❌ FIRMS_KEY 누락됨")
        return

    # 기간 설정
    start_date = datetime(2024, 10, 1)
    end_date = datetime(2025, 4, 1)
    
    source = "VIIRS_SNPP_NRT"
    bbox = "124,33,132,39"  # 한국 영역
    
    print(f"🛰️ NASA FIRMS 데이터 수집 시작")
    print(f"📅 기간: {start_date.strftime('%Y-%m-%d')} ~ {end_date.strftime('%Y-%m-%d')}")
    print(f"🗺️ 영역: {bbox} (한국)")

    # 파일 경로 설정
    base_dir = os.path.abspath(os.path.join(__file__, "..", ".."))
    save_path = os.path.join(base_dir, "public", "data", "nasa_firms_korea_2024_2025.json")
    os.makedirs(os.path.dirname(save_path), exist_ok=True)
    
    # 기존 데이터 로드
    existing_data = load_existing_data(save_path)
    existing_set = {json.dumps(entry, sort_keys=True) for entry in existing_data}
    
    print(f"📂 기존 데이터: {len(existing_data)}건")

    all_new_data = []
    current_date = start_date
    request_count = 0
    
    # 10일씩 나누어 요청 (API 제한)
    while current_date < end_date:
        # 10일 범위 계산
        range_end = min(current_date + timedelta(days=9), end_date - timedelta(days=1))
        
        # 날짜 포맷 변환 (YYYY-MM-DD)
        date_start_str = current_date.strftime("%Y-%m-%d")
        date_end_str = range_end.strftime("%Y-%m-%d")
        
        # API URL 생성 (날짜 범위 지정)
        url = f"https://firms.modaps.eosdis.nasa.gov/api/area/csv/{map_key}/{source}/{bbox}/1/{date_start_str}"
        
        print(f"\n📡 요청 {request_count + 1}: {date_start_str} ~ {date_end_str}")
        print(f"🌐 URL: {url}")

        try:
            response = requests.get(url, timeout=30)
            response.raise_for_status()
            
            # CSV 파싱
            decoded = response.content.decode("utf-8").splitlines()
            reader = csv.DictReader(decoded)
            range_data = list(reader)
            
            # 날짜 필터링 (API가 정확한 날짜 범위를 보장하지 않을 수 있음)
            filtered_data = []
            for entry in range_data:
                try:
                    entry_date = datetime.strptime(entry["acq_date"], "%Y-%m-%d")
                    if current_date <= entry_date <= range_end:
                        filtered_data.append(entry)
                except (ValueError, KeyError):
                    continue
            
            print(f"📥 수신: {len(range_data)}건 → 필터링 후: {len(filtered_data)}건")
            all_new_data.extend(filtered_data)
            
            request_count += 1
            
            # API 부하 방지 (1초 대기)
            time.sleep(1)
            
        except requests.exceptions.RequestException as e:
            print(f"❌ API 요청 오류 ({date_start_str}): {e}")
            
        except Exception as e:
            print(f"❌ 데이터 처리 오류 ({date_start_str}): {e}")
        
        # 다음 10일로 이동
        current_date = range_end + timedelta(days=1)

    print(f"\n🔄 전체 수집 완료: {len(all_new_data)}건")

    # 중복 제거
    unique_new_data = []
    for entry in all_new_data:
        entry_json = json.dumps(entry, sort_keys=True)
        if entry_json not in existing_set:
            unique_new_data.append(entry)
            existing_set.add(entry_json)

    # 기존 데이터와 병합
    combined_data = existing_data + unique_new_data
    
    # 날짜순 정렬
    def get_date_key(entry):
        try:
            date_str = entry.get("acq_date", "")
            time_str = entry.get("acq_time", "0000")
            datetime_str = f"{date_str} {time_str[:2]}:{time_str[2:]}"
            return datetime.strptime(datetime_str, "%Y-%m-%d %H:%M")
        except:
            return datetime.min
    
    combined_data.sort(key=get_date_key)

    # 파일 저장
    with open(save_path, "w", encoding="utf-8") as f:
        json.dump(combined_data, f, ensure_ascii=False, indent=2)

    print(f"\n✅ 저장 완료!")
    print(f"📁 파일 위치: {save_path}")
    print(f"📊 신규 데이터: {len(unique_new_data)}건")
    print(f"📊 전체 데이터: {len(combined_data)}건")
    print(f"🌐 총 API 요청: {request_count}회")

    # 월별 통계
    monthly_stats = {}
    for entry in combined_data:
        try:
            date_str = entry.get("acq_date", "")
            if len(date_str) >= 7:
                month_key = date_str[:7]  # YYYY-MM
                monthly_stats[month_key] = monthly_stats.get(month_key, 0) + 1
        except:
            continue

    print(f"\n📈 월별 NASA 화재 감지 통계:")
    for month in sorted(monthly_stats.keys()):
        count = monthly_stats[month]
        print(f"  {month}: {count:4d}건")

    # 신뢰도별 통계
    confidence_stats = {}
    brightness_values = []
    
    for entry in combined_data:
        conf = entry.get("confidence", "unknown")
        confidence_stats[conf] = confidence_stats.get(conf, 0) + 1
        
        try:
            brightness = float(entry.get("brightness", 0))
            if brightness > 0:
                brightness_values.append(brightness)
        except:
            pass

    print(f"\n🎯 신뢰도별 분포:")
    for conf in sorted(confidence_stats.keys()):
        count = confidence_stats[conf]
        print(f"  {conf}: {count:4d}건")

    if brightness_values:
        avg_brightness = sum(brightness_values) / len(brightness_values)
        print(f"\n🔆 평균 밝기: {avg_brightness:.1f}K")

if __name__ == "__main__":
    fetch_firms_historical_range()