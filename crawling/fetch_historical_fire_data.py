# 2024-10-01 ~ 2025-04-01 산림청 데이터 크롤링 파일
import requests
import json
import os
from datetime import datetime, timedelta
import time

def fetch_forest_data_range():
    """2024-10-01부터 2025-04-01까지의 산림청 화재 데이터를 수집"""
    
    # 고정된 날짜 범위 설정
    start_date = datetime(2024, 10, 1)
    end_date = datetime(2025, 4, 1)
    
    url = "https://fd.forest.go.kr/ffas/pubConn/occur/getPublicShowFireInfoList.do"
    headers = {"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"}
    
    all_fires = []
    current_date = start_date
    
    print(f"📅 수집 기간: {start_date.strftime('%Y-%m-%d')} ~ {end_date.strftime('%Y-%m-%d')}")
    
    # 월별로 나누어서 요청 (API 부하 방지)
    while current_date < end_date:
        # 현재 월의 마지막 날 계산
        if current_date.month == 12:
            next_month = current_date.replace(year=current_date.year + 1, month=1, day=1)
        else:
            next_month = current_date.replace(month=current_date.month + 1, day=1)
        
        month_end = min(next_month - timedelta(days=1), end_date)
        
        payload = {
            "param": {
                "startDtm": current_date.strftime("%Y%m%d"),
                "endDtm": month_end.strftime("%Y%m%d"),
                "regionCode": "",
                "issuCode": "",
                "prgrsCode": "",
                "sttnMapCheckFlag": "",
                "perPage": 1000,  # 한 번에 더 많은 데이터 요청
                "perPageList": 10,
                "pageListStart": 0,
                "pageListEnd": 10,
                "currentPage": 1,
                "lastPage": 1,
                "totalCount": 1000,
                "total_count": 1000,
                "last_page": 1
            },
            "pager": {
                "perPage": 1000,
                "perPageList": 10,
                "pageListStart": 0,
                "pageListEnd": 10,
                "currentPage": 1,
                "lastPage": 1,
                "totalCount": 1000,
                "total_count": 1000,
                "last_page": 1
            }
        }
        
        print(f"📦 요청 중: {current_date.strftime('%Y-%m-%d')} ~ {month_end.strftime('%Y-%m-%d')}")
        
        try:
            response = requests.post(url, headers=headers, json=payload, timeout=15)
            
            if response.status_code == 200:
                data = response.json()
                month_fires = data.get("frfrInfoList", [])
                
                print(f"✅ {current_date.strftime('%Y-%m')} 화재 데이터: {len(month_fires)}건")
                all_fires.extend(month_fires)
                
                # 페이지네이션 처리 (총 데이터가 1000건을 넘는 경우)
                total_count = data.get("totalCount", 0)
                if total_count > 1000:
                    pages_needed = (total_count // 1000) + 1
                    
                    for page in range(2, pages_needed + 1):
                        payload["param"]["currentPage"] = page
                        payload["pager"]["currentPage"] = page
                        
                        print(f"📄 추가 페이지 요청: {page}/{pages_needed}")
                        
                        response = requests.post(url, headers=headers, json=payload, timeout=15)
                        if response.status_code == 200:
                            page_data = response.json()
                            page_fires = page_data.get("frfrInfoList", [])
                            all_fires.extend(page_fires)
                            print(f"✅ 페이지 {page} 추가: {len(page_fires)}건")
                        
                        time.sleep(1)  # API 부하 방지
                        
            else:
                print(f"❌ HTTP 오류: {response.status_code}")
                
        except Exception as e:
            print(f"❌ 요청 오류 ({current_date.strftime('%Y-%m')}): {e}")
        
        # 다음 달로 이동
        current_date = next_month
        time.sleep(2)  # API 부하 방지를 위한 대기
    
    # 중복 제거 (frfr_info_id 기준)
    unique_fires = []
    seen_ids = set()
    
    for fire in all_fires:
        fire_id = fire.get("frfr_info_id")
        if fire_id and fire_id not in seen_ids:
            unique_fires.append(fire)
            seen_ids.add(fire_id)
    
    print(f"🔄 중복 제거: {len(all_fires)} → {len(unique_fires)}건")
    
    # 날짜순 정렬
    def get_date_key(fire):
        occu_dtm = fire.get("occu_dtm", "")
        if occu_dtm:
            try:
                return datetime.strptime(occu_dtm, "%Y%m%d%H%M%S")
            except:
                try:
                    return datetime.strptime(occu_dtm[:8], "%Y%m%d")
                except:
                    return datetime.min
        return datetime.min
    
    unique_fires.sort(key=get_date_key)
    
    # 저장 경로 설정
    save_path = os.path.abspath(os.path.join(__file__, "..", "..", "public", "data", "korea_fire_2024_2025.json"))
    os.makedirs(os.path.dirname(save_path), exist_ok=True)
    
    # JSON 파일로 저장
    with open(save_path, "w", encoding="utf-8") as f:
        json.dump(unique_fires, f, ensure_ascii=False, indent=2)
    
    print(f"💾 저장 완료 → {save_path}")
    print(f"📊 총 데이터: {len(unique_fires)}건")
    
    # 월별 통계 출력
    monthly_stats = {}
    for fire in unique_fires:
        occu_dtm = fire.get("occu_dtm", "")
        if len(occu_dtm) >= 6:
            month_key = occu_dtm[:6]  # YYYYMM
            monthly_stats[month_key] = monthly_stats.get(month_key, 0) + 1
    
    print("\n📈 월별 화재 발생 현황:")
    for month in sorted(monthly_stats.keys()):
        year = month[:4]
        mon = month[4:6]
        count = monthly_stats[month]
        print(f"  {year}-{mon}: {count:4d}건")
    
    return unique_fires

if __name__ == "__main__":
    print("🔥 산림청 화재 데이터 수집 시작 (2024-10-01 ~ 2025-04-01)")
    
    try:
        fires_data = fetch_forest_data_range()
        
        print("\n✅ 수집 완료!")
        print(f"📁 데이터 파일: public/data/korea_fire_2024_2025.json")
        print(f"📊 총 {len(fires_data)}건의 화재 데이터가 저장되었습니다.")
        
    except Exception as e:
        print(f"❌ 전체 프로세스 오류: {e}")
        import traceback
        traceback.print_exc()