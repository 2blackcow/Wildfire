import requests
import json
import os
from datetime import datetime, timedelta

def fetch_forest_data():
    today = datetime.today()
    start = today - timedelta(days=6)

    url = "https://fd.forest.go.kr/ffas/pubConn/occur/getPublicShowFireInfoList.do"
    headers = {"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"}

    payload = {
        "param": {
            "startDtm": start.strftime("%Y%m%d"),
            "endDtm": today.strftime("%Y%m%d"),
            "regionCode": "",
            "issuCode": "",
            "prgrsCode": "",
            "sttnMapCheckFlag": "",
            "perPage": 100,
            "perPageList": 10,
            "pageListStart": 0,
            "pageListEnd": 10,
            "currentPage": 1,
            "lastPage": 1,
            "totalCount": 8,
            "total_count": 8,
            "last_page": 1
        },
        "pager": {
            "perPage": 10,
            "perPageList": 10,
            "pageListStart": 0,
            "pageListEnd": 10,
            "currentPage": 1,
            "lastPage": 1,
            "totalCount": 8,
            "total_count": 8,
            "last_page": 1
        }
    }

    print(f"📦 요청: {payload['param']['startDtm']} ~ {payload['param']['endDtm']}")

    try:
        response = requests.post(url, headers=headers, json=payload, timeout=10)
        data = response.json()
        new_fires = data.get("frfrInfoList", [])

        print(f"✅ 새로 받은 화재: {len(new_fires)}건")

        # ✅ 저장 경로 (korea_fire_full.json으로 통일)
        save_path = os.path.abspath(os.path.join(__file__, "..", "..", "public", "data", "korea_fire_live.json"))
        os.makedirs(os.path.dirname(save_path), exist_ok=True)

        # ✅ 기존 파일 읽기 (없으면 빈 리스트)
        if os.path.exists(save_path):
            with open(save_path, "r", encoding="utf-8") as f:
                existing = json.load(f)
        else:
            existing = []

        # 🔄 기존 데이터를 딕셔너리로 변환 (ID 기준)
        existing_dict = {f["frfr_info_id"]: f for f in existing}
        
        updated_count = 0
        new_count = 0
        
        # 🔄 각 새 데이터에 대해 추가 또는 업데이트 처리
        for new_fire in new_fires:
            fire_id = new_fire["frfr_info_id"]
            
            # 🔄 필드명 통일 (웹사이트에서 사용하는 필드명으로 변환)
            standardized_fire = {
                # 기본 정보
                "frfr_info_id": fire_id,
                "start": new_fire.get("frfr_frng_dtm"),           # 발생일시
                "time": new_fire.get("potfr_end_dtm"),            # 진화일시
                "address": new_fire.get("frfr_sttmn_addr"),       # 주소
                "status": new_fire.get("frfr_prgrs_stcd_str"),    # 진행상태
                "level": new_fire.get("frfr_step_issu_cd"),       # 대응단계
                "lat": float(new_fire.get("frfr_lctn_ycrd", 0)),  # 위도
                "lon": float(new_fire.get("frfr_lctn_xcrd", 0)),  # 경도
                
                # 원본 데이터도 유지
                **new_fire
            }
            
            if fire_id in existing_dict:
                # 기존 데이터와 비교하여 변경사항 확인
                old_fire = existing_dict[fire_id]
                
                # 주요 필드들 비교
                changed_fields = []
                
                # 진행상태 변경 확인
                if old_fire.get("frfr_prgrs_stcd_str") != new_fire.get("frfr_prgrs_stcd_str"):
                    changed_fields.append(f"상태: {old_fire.get('frfr_prgrs_stcd_str')} → {new_fire.get('frfr_prgrs_stcd_str')}")
                
                # 진화일시 변경 확인 (None에서 실제 시간으로)
                old_end_time = old_fire.get("potfr_end_dtm")
                new_end_time = new_fire.get("potfr_end_dtm")
                if old_end_time != new_end_time:
                    changed_fields.append(f"진화일시: {old_end_time or '미정'} → {new_end_time or '미정'}")
                
                # 대응단계 변경 확인
                if old_fire.get("frfr_step_issu_cd") != new_fire.get("frfr_step_issu_cd"):
                    changed_fields.append(f"대응단계: {old_fire.get('frfr_step_issu_cd')} → {new_fire.get('frfr_step_issu_cd')}")
                
                # 발생위치 정보 변경 확인
                if old_fire.get("frfr_sttmn_addr") != new_fire.get("frfr_sttmn_addr"):
                    changed_fields.append(f"위치: {old_fire.get('frfr_sttmn_addr')} → {new_fire.get('frfr_sttmn_addr')}")
                
                # 🔥 강제 업데이트 조건 추가
                # 진화중인데 진화일시가 있으면 상태 불일치로 간주
                if (old_fire.get("frfr_prgrs_stcd_str") == "진화중" and 
                    new_fire.get("potfr_end_dtm") and 
                    new_fire.get("frfr_prgrs_stcd_str") == "진화완료"):
                    changed_fields.append("🔄 상태 불일치 감지 - 강제 업데이트")
                
                if changed_fields:
                    print(f"🔄 상태 변경 감지: {fire_id}")
                    for change in changed_fields:
                        print(f"   • {change}")
                    
                    # 기존 데이터를 새 데이터로 업데이트
                    existing_dict[fire_id] = standardized_fire
                    updated_count += 1
                else:
                    # 변경사항 없음
                    pass
            else:
                # 완전히 새로운 화재
                print(f"🆕 신규 화재: {fire_id} - {new_fire.get('frfr_sttmn_addr', '위치불명')}")
                existing_dict[fire_id] = standardized_fire
                new_count += 1

        print(f"🆕 신규 추가: {new_count}건")
        print(f"🔄 상태 업데이트: {updated_count}건")

        # 최종 데이터 생성 (딕셔너리를 다시 리스트로 변환)
        final_data = list(existing_dict.values())
        
        # 날짜순 정렬 (최신순)
        final_data.sort(key=lambda x: x.get("fofr_date", ""), reverse=True)

        # 파일 저장
        with open(save_path, "w", encoding="utf-8") as f:
            json.dump(final_data, f, ensure_ascii=False, indent=2)

        print(f"💾 저장 완료 → {save_path} (총 {len(final_data)}건)")
        
        # 📊 현재 시간 기록
        print(f"⏰ 마지막 업데이트: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    except Exception as e:
        print("❌ 오류 발생:", e)
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    fetch_forest_data()