import os
import requests
import csv
import json
from dotenv import load_dotenv

def load_existing_data(path):
    if not os.path.exists(path):
        return []
    with open(path, "r", encoding="utf-8") as f:
        try:
            return json.load(f)
        except:
            return []

def fetch_firms_csv():
    dotenv_path = os.path.abspath(os.path.join(__file__, "..", "..", ".env"))
    load_dotenv(dotenv_path)
    map_key = os.getenv("FIRMS_KEY") or "d4c10c572f34e93458cca9cd34424991"

    if not map_key:
        print("❌ MAP_KEY 누락됨")
        return

    source = "VIIRS_SNPP_NRT"
    bbox = "124,33,132,39"
    day_range = 7
    url = f"https://firms.modaps.eosdis.nasa.gov/api/area/csv/{map_key}/{source}/{bbox}/{day_range}"

    print(f"🌐 CSV 요청: {url}")

    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        decoded = response.content.decode("utf-8").splitlines()
        reader = csv.DictReader(decoded)
        new_data = list(reader)

        print(f"📥 수신: {len(new_data)}건")

        # 기존 데이터 로드
        base_dir = os.path.abspath(os.path.join(__file__, "..", ".."))
        save_path = os.path.join(base_dir, "public", "data", "nasa_firms_korea.json")
        os.makedirs(os.path.dirname(save_path), exist_ok=True)
        existing_data = load_existing_data(save_path)

        # 중복 제거 기준: JSON 문자열화 후 비교
        existing_set = {json.dumps(entry, sort_keys=True) for entry in existing_data}
        unique_new_data = [
            entry for entry in new_data
            if json.dumps(entry, sort_keys=True) not in existing_set
        ]

        combined = existing_data + unique_new_data
        with open(save_path, "w", encoding="utf-8") as f:
            json.dump(combined, f, ensure_ascii=False, indent=2)

        print(f"✅ 중복 제거 후 새로 추가된 항목: {len(unique_new_data)}건")
        print(f"💾 총 저장 수: {len(combined)}건 → {save_path}")

    except Exception as e:
        print("❌ 오류 발생:", e)

if __name__ == "__main__":
    fetch_firms_csv()
