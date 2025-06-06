import os
import json
from datetime import datetime
from math import radians, cos, sin, sqrt, atan2

def haversine(lat1, lon1, lat2, lon2):
    R = 6371
    d_lat = radians(lat2 - lat1)
    d_lon = radians(lon2 - lon1)
    a = sin(d_lat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(d_lon / 2) ** 2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return R * c

def parse_fire_date(date_str):
    if not date_str:
        return None
    try:
        if ' ' in date_str:
            date_part = date_str.split(' ')[0]
        else:
            date_part = date_str
        if '-' in date_part and len(date_part) == 10:
            return datetime.strptime(date_part, "%Y-%m-%d")
        if len(date_part) == 8 and date_part.isdigit():
            return datetime.strptime(date_part, "%Y%m%d")
    except:
        pass
    print(f"⚠️ 날짜 파싱 실패: {date_str}")
    return None

def analyze_data_ranges(fires, firms):
    print("\n📊 데이터 분석:")
    fire_lats, fire_lons, fire_dates = [], [], []
    for fire in fires:
        try:
            lat = float(fire.get("frfr_lctn_ycrd", 0))
            lon = float(fire.get("frfr_lctn_xcrd", 0))
            date = parse_fire_date(fire.get("frfr_frng_dtm", "") or fire.get("frfr_sttmn_dt", ""))
            if lat and lon and date:
                fire_lats.append(lat)
                fire_lons.append(lon)
                fire_dates.append(date)
        except:
            continue
    if fire_lats:
        print(f"🔥 화재 위도: {min(fire_lats):.4f} ~ {max(fire_lats):.4f}")
        print(f"🔥 화재 경도: {min(fire_lons):.4f} ~ {max(fire_lons):.4f}")
        print(f"🔥 화재 날짜: {min(fire_dates).date()} ~ {max(fire_dates).date()}")

    firms_lats, firms_lons, firms_dates = [], [], []
    for firm in firms:
        try:
            firms_lats.append(float(firm["latitude"]))
            firms_lons.append(float(firm["longitude"]))
            firms_dates.append(datetime.strptime(firm["acq_date"], "%Y-%m-%d"))
        except:
            continue
    if firms_lats:
        print(f"🛰️ NASA 위도: {min(firms_lats):.4f} ~ {max(firms_lats):.4f}")
        print(f"🛰️ NASA 경도: {min(firms_lons):.4f} ~ {max(firms_lons):.4f}")
        print(f"🛰️ NASA 날짜: {min(firms_dates).date()} ~ {max(firms_dates).date()}")

def augment_firms_improved():
    root_dir = os.path.dirname(os.path.abspath(__file__))
    base_dir = os.path.abspath(os.path.join(root_dir, "..", "public", "data"))
    fire_input_path = os.path.join(base_dir, "korea_fire_weather.json")
    firms_input_path = os.path.join(base_dir, "nasa_firms_korea.json")
    output_path = os.path.join(base_dir, "korea_fire_full.json")

    if not os.path.exists(fire_input_path) or not os.path.exists(firms_input_path):
        print("❌ 입력 파일 없음")
        return

    with open(fire_input_path, "r", encoding="utf-8") as f:
        fires = json.load(f)
    with open(firms_input_path, "r", encoding="utf-8") as f:
        firms = json.load(f)

    if os.path.exists(output_path):
        with open(output_path, "r", encoding="utf-8") as f:
            existing_data = json.load(f)
        existing_map = {e["frfr_info_id"]: e for e in existing_data if "frfr_info_id" in e}
    else:
        existing_map = {}

    print(f"🔥 화재 항목: {len(fires)}개")
    print(f"🛰️ NASA 포인트: {len(firms)}개")
    analyze_data_ranges(fires, firms)

    enriched = []
    matched = 0
    skipped = 0
    total_processed = 0
    distance_thresholds = [5.0, 10.0, 20.0, 50.0]

    for fire in fires:
        fire_id = fire.get("frfr_info_id")
        if fire_id in existing_map:
            print(f"🛑 이미 처리됨 → 건너뜀: {fire_id}")
            enriched.append(existing_map[fire_id])
            skipped += 1
            continue

        try:
            lat = float(fire.get("frfr_lctn_ycrd", 0))
            lon = float(fire.get("frfr_lctn_xcrd", 0))
            date_str = fire.get("frfr_frng_dtm", "") or fire.get("frfr_sttmn_dt", "")
            fire_date = parse_fire_date(date_str)
            if not fire_date or not lat or not lon:
                print(f"⚠️ 화재 데이터 부족: lat={lat}, lon={lon}, date={date_str}")
                continue

            total_processed += 1
            print(f"\n🔍 화재 #{total_processed}: ({lat:.4f}, {lon:.4f}) at {fire_date.date()}")
        except Exception as e:
            print(f"❌ 화재 데이터 파싱 오류: {e}")
            continue

        closest = None
        min_dist = float("inf")
        candidates = []

        for firm in firms:
            try:
                firm_date = datetime.strptime(firm["acq_date"], "%Y-%m-%d")
                if abs((firm_date - fire_date).days) > 3:
                    continue
                firm_lat = float(firm["latitude"])
                firm_lon = float(firm["longitude"])
                dist = haversine(lat, lon, firm_lat, firm_lon)
                if dist <= 50.0:
                    candidates.append({'firm': firm, 'distance': dist})
                if dist < min_dist:
                    min_dist = dist
                    closest = firm
            except:
                continue

        print(f"   📍 후보 {len(candidates)}개, 최단거리: {min_dist:.2f}km")

        matched_threshold = next((t for t in distance_thresholds if min_dist <= t), None)
        if closest and matched_threshold:
            fire["brightness"] = float(closest.get("bright_ti4", 0))
            fire["frp"] = float(closest.get("frp", 0))
            fire["confidence"] = closest.get("confidence", "")
            fire["satellite"] = closest.get("satellite", "")
            fire["instrument"] = closest.get("instrument", "")
            fire["nasa_distance_km"] = round(min_dist, 2)
            fire["nasa_match_threshold"] = matched_threshold
            matched += 1
            print(f"   ✅ 매칭 성공 (거리: {min_dist:.2f}km, 임계값: {matched_threshold}km)")
        else:
            fire["brightness"] = None
            fire["frp"] = None
            fire["confidence"] = None
            fire["satellite"] = None
            fire["instrument"] = None
            fire["nasa_distance_km"] = None
            fire["nasa_match_threshold"] = None
            print("   ❌ 매칭 실패")

        enriched.append(fire)

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(enriched, f, ensure_ascii=False, indent=2)

    print(f"\n✅ 병합 완료 → {output_path}")
    print(f"📌 매칭된 화재: {matched}/{total_processed}개 ({matched/max(total_processed,1)*100:.1f}%)")
    print(f"⏭️ 기존 건너뜀: {skipped}개")

    stats = {}
    for f in enriched:
        t = f.get("nasa_match_threshold")
        if t:
            stats[t] = stats.get(t, 0) + 1
    if stats:
        print("📊 거리별 매칭 통계:")
        for k in sorted(stats):
            print(f"   {k}km 이내: {stats[k]}개")

if __name__ == "__main__":
    augment_firms_improved()
