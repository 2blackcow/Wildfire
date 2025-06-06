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

        # ✅ 저장 경로
        save_path = os.path.abspath(os.path.join(__file__, "..", "..", "public", "data", "korea_fire_live.json"))
        os.makedirs(os.path.dirname(save_path), exist_ok=True)

        # ✅ 기존 파일 읽기 (없으면 빈 리스트)
        if os.path.exists(save_path):
            with open(save_path, "r", encoding="utf-8") as f:
                existing = json.load(f)
        else:
            existing = []

        existing_ids = {f["frfr_info_id"] for f in existing}
        unique_new = [f for f in new_fires if f["frfr_info_id"] not in existing_ids]

        print(f"🆕 중복 제거 후 신규: {len(unique_new)}건")

        final_data = existing + unique_new

        with open(save_path, "w", encoding="utf-8") as f:
            json.dump(final_data, f, ensure_ascii=False, indent=2)

        print(f"💾 저장 완료 → {save_path} (총 {len(final_data)}건)")

    except Exception as e:
        print("❌ 오류 발생:", e)

if __name__ == "__main__":
    fetch_forest_data()
