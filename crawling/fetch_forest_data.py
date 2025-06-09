import requests
import json
import os
from datetime import datetime, timedelta
import time

def fetch_forest_data():
    today = datetime.today()
    start = today - timedelta(days=6)

    url = "https://fd.forest.go.kr/ffas/pubConn/occur/getPublicShowFireInfoList.do"
    headers = {"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"}

    print(f"📦 요청 기간: {start.strftime('%Y-%m-%d')} ~ {today.strftime('%Y-%m-%d')}")

    try:
        # 🔄 모든 페이지의 데이터를 수집
        all_fires = []
        current_page = 1
        max_pages = 10  # 안전장치: 최대 10페이지까지만 시도
        
        while current_page <= max_pages:
            payload = {
                "param": {
                    "startDtm": start.strftime("%Y%m%d"),
                    "endDtm": today.strftime("%Y%m%d"),
                    "regionCode": "",
                    "issuCode": "",
                    "prgrsCode": "",
                    "sttnMapCheckFlag": "",
                    "perPage": 30,  # 산림청 사이트 최대값에 맞춤
                    "perPageList": 10,
                    "pageListStart": 0,
                    "pageListEnd": 10,
                    "currentPage": current_page,
                    "lastPage": 1,
                    "totalCount": 30,
                    "total_count": 30,
                    "last_page": 1
                },
                "pager": {
                    "perPage": 30,
                    "perPageList": 10,
                    "pageListStart": 0,
                    "pageListEnd": 10,
                    "currentPage": current_page,
                    "lastPage": 1,
                    "totalCount": 30,
                    "total_count": 30,
                    "last_page": 1
                }
            }

            print(f"📄 페이지 {current_page} 요청 중...")

            response = requests.post(url, headers=headers, json=payload, timeout=10)
            
            # 응답 상태 확인
            if response.status_code != 200:
                print(f"❌ API 응답 오류: {response.status_code}")
                break
                
            data = response.json()
            
            # 응답 구조 확인 (첫 번째 페이지에서만)
            if current_page == 1:
                print(f"🔍 API 응답 구조 확인:")
                print(f"   - 응답 키들: {list(data.keys())}")
                if 'totalCount' in data:
                    print(f"   - totalCount: {data['totalCount']}")
                if 'total_count' in data:
                    print(f"   - total_count: {data['total_count']}")
                if 'param' in data and isinstance(data['param'], dict):
                    print(f"   - param totalCount: {data['param'].get('totalCount', 'N/A')}")
            
            # 현재 페이지의 화재 데이터 추출
            page_fires = data.get("frfrInfoList", [])
            
            if not page_fires:
                print(f"📄 페이지 {current_page}: 데이터 없음 - 수집 종료")
                break
            
            all_fires.extend(page_fires)
            print(f"✅ 페이지 {current_page}: {len(page_fires)}건 수집 (누적: {len(all_fires)}건)")
            
            # 더 이상 데이터가 없으면 종료
            if len(page_fires) < 30:  # perPage보다 적으면 마지막 페이지
                print(f"📄 마지막 페이지 도달 (데이터 {len(page_fires)}건 < 30건)")
                break
                
            # 다음 페이지로
            current_page += 1
            
            # API 부하 방지를 위한 잠시 대기
            time.sleep(0.5)

        print(f"🔥 총 수집된 화재: {len(all_fires)}건")

        if len(all_fires) == 0:
            print("❌ 수집된 데이터가 없습니다. 기존 데이터를 유지합니다.")
            return

        # ✅ 저장 경로
        save_path = os.path.abspath(os.path.join(__file__, "..", "..", "public", "data", "korea_fire_live.json"))
        os.makedirs(os.path.dirname(save_path), exist_ok=True)

        # ✅ 기존 파일 읽기 (비교용)
        existing_fires = []
        if os.path.exists(save_path):
            with open(save_path, "r", encoding="utf-8") as f:
                existing_fires = json.load(f)

        # 🔄 기존 데이터를 ID 기준으로 딕셔너리 변환 (비교용)
        existing_dict = {f["frfr_info_id"]: f for f in existing_fires}
        
        # 🔄 새 데이터 처리 및 표준화
        processed_fires = []
        new_count = 0
        updated_count = 0
        
        for fire in all_fires:
            fire_id = fire["frfr_info_id"]
            
            # 🔄 필드명 통일 (웹사이트에서 사용하는 필드명으로 변환)
            standardized_fire = {
                # 기본 정보
                "frfr_info_id": fire_id,
                "start": fire.get("frfr_frng_dtm"),           # 발생일시
                "time": fire.get("potfr_end_dtm"),            # 진화일시
                "address": fire.get("frfr_sttmn_addr"),       # 주소
                "status": fire.get("frfr_prgrs_stcd_str"),    # 진행상태
                "level": fire.get("frfr_step_issu_cd"),       # 대응단계
                "lat": float(fire.get("frfr_lctn_ycrd", 0)),  # 위도
                "lon": float(fire.get("frfr_lctn_xcrd", 0)),  # 경도
                
                # 원본 데이터도 유지
                **fire
            }
            
            # 🔍 기존 데이터와 비교하여 변경사항 확인
            if fire_id in existing_dict:
                old_fire = existing_dict[fire_id]
                
                # 주요 필드들 비교
                changed_fields = []
                
                # 진행상태 변경 확인
                if old_fire.get("frfr_prgrs_stcd_str") != fire.get("frfr_prgrs_stcd_str"):
                    changed_fields.append(f"상태: {old_fire.get('frfr_prgrs_stcd_str')} → {fire.get('frfr_prgrs_stcd_str')}")
                
                # 진화일시 변경 확인
                old_end_time = old_fire.get("potfr_end_dtm")
                new_end_time = fire.get("potfr_end_dtm")
                if old_end_time != new_end_time:
                    changed_fields.append(f"진화일시: {old_end_time or '미정'} → {new_end_time or '미정'}")
                
                # 대응단계 변경 확인
                if old_fire.get("frfr_step_issu_cd") != fire.get("frfr_step_issu_cd"):
                    changed_fields.append(f"대응단계: {old_fire.get('frfr_step_issu_cd')} → {fire.get('frfr_step_issu_cd')}")
                
                # 발생위치 정보 변경 확인
                if old_fire.get("frfr_sttmn_addr") != fire.get("frfr_sttmn_addr"):
                    changed_fields.append(f"위치: {old_fire.get('frfr_sttmn_addr')} → {fire.get('frfr_sttmn_addr')}")
                
                if changed_fields:
                    print(f"🔄 상태 변경: {fire_id} - {fire.get('frfr_sttmn_addr', '위치불명')}")
                    for change in changed_fields:
                        print(f"   • {change}")
                    updated_count += 1
            else:
                # 완전히 새로운 화재
                print(f"🆕 신규 화재: {fire_id} - {fire.get('frfr_sttmn_addr', '위치불명')} ({fire.get('frfr_frng_dtm', '시간불명')})")
                new_count += 1
            
            processed_fires.append(standardized_fire)

        # 🗑️ 산림청에서 제거된 화재 확인
        current_fire_ids = {f["frfr_info_id"] for f in all_fires}
        removed_fires = []
        
        for existing_fire in existing_fires:
            if existing_fire["frfr_info_id"] not in current_fire_ids:
                removed_fires.append(existing_fire)
                print(f"🗑️ 산림청에서 제거됨: {existing_fire['frfr_info_id']} - {existing_fire.get('frfr_sttmn_addr', '위치불명')}")

        # 📊 변경사항 요약
        print(f"\n📊 수집 결과:")
        print(f"   🆕 신규 추가: {new_count}건")
        print(f"   🔄 상태 업데이트: {updated_count}건")
        print(f"   🗑️ 제거된 화재: {len(removed_fires)}건")
        print(f"   📝 최종 저장: {len(processed_fires)}건")

        # 날짜순 정렬 (최신순)
        processed_fires.sort(key=lambda x: x.get("frfr_frng_dtm", ""), reverse=True)

        # 💾 산림청 데이터로 완전 교체하여 저장
        with open(save_path, "w", encoding="utf-8") as f:
            json.dump(processed_fires, f, ensure_ascii=False, indent=2)

        print(f"💾 저장 완료 → {save_path}")
        print(f"🔄 산림청 데이터와 완전 동기화됨")
        
        # 📊 현재 시간 기록
        print(f"⏰ 마지막 업데이트: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

        # 📋 날짜별 화재 현황 요약
        if processed_fires:
            print(f"\n📅 날짜별 화재 현황:")
            date_count = {}
            for fire in processed_fires:
                fire_date = fire.get("frfr_sttmn_dt", "")
                if fire_date:
                    formatted_date = f"{fire_date[:4]}-{fire_date[4:6]}-{fire_date[6:8]}"
                    date_count[formatted_date] = date_count.get(formatted_date, 0) + 1
            
            for date_str in sorted(date_count.keys(), reverse=True):
                print(f"   {date_str}: {date_count[date_str]}건")

    except Exception as e:
        print("❌ 오류 발생:", e)
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    fetch_forest_data()