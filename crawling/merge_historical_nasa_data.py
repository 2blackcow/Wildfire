import os
import json
from datetime import datetime
from math import radians, cos, sin, sqrt, atan2

def haversine(lat1, lon1, lat2, lon2):
    """두 좌표 간 거리 계산 (km)"""
    R = 6371
    d_lat = radians(lat2 - lat1)
    d_lon = radians(lon2 - lon1)
    a = sin(d_lat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(d_lon / 2) ** 2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return R * c

def parse_fire_date(fire_data):
    """화재 데이터에서 날짜 파싱"""
    # 여러 필드에서 날짜 정보 시도
    date_fields = ["occu_dtm", "frfr_frng_dtm", "frfr_sttmn_dt"]
    
    for field in date_fields:
        date_str = fire_data.get(field, "")
        if not date_str:
            continue
            
        try:
            # 공백으로 분리된 경우 첫 번째 부분만 사용
            if ' ' in date_str:
                date_part = date_str.split(' ')[0]
            else:
                date_part = date_str
            
            # YYYY-MM-DD 형태
            if '-' in date_part and len(date_part) == 10:
                return datetime.strptime(date_part, "%Y-%m-%d")
            
            # YYYYMMDD 형태
            if len(date_part) == 8 and date_part.isdigit():
                return datetime.strptime(date_part, "%Y%m%d")
                
            # YYYYMMDDHHMMSS 형태
            if len(date_part) >= 8 and date_part.isdigit():
                return datetime.strptime(date_part[:8], "%Y%m%d")
                
        except Exception:
            continue
    
    return None

def get_fire_coordinates(fire_data):
    """화재 데이터에서 좌표 추출"""
    lat_fields = ["frfr_lctn_ycrd", "latitude", "lat", "y_coord"]
    lon_fields = ["frfr_lctn_xcrd", "longitude", "lon", "x_coord"]
    
    lat = None
    lon = None
    
    for field in lat_fields:
        if field in fire_data and fire_data[field]:
            try:
                lat = float(fire_data[field])
                break
            except (ValueError, TypeError):
                continue
    
    for field in lon_fields:
        if field in fire_data and fire_data[field]:
            try:
                lon = float(fire_data[field])
                break
            except (ValueError, TypeError):
                continue
    
    return lat, lon

def analyze_data_ranges(fires, firms):
    """데이터 범위 분석"""
    print("\n📊 데이터 분석:")
    
    # 화재 데이터 분석
    fire_lats, fire_lons, fire_dates = [], [], []
    for fire in fires:
        lat, lon = get_fire_coordinates(fire)
        date = parse_fire_date(fire)
        if lat and lon and date:
            fire_lats.append(lat)
            fire_lons.append(lon)
            fire_dates.append(date)
    
    if fire_lats:
        print(f"🔥 화재 위도: {min(fire_lats):.4f} ~ {max(fire_lats):.4f}")
        print(f"🔥 화재 경도: {min(fire_lons):.4f} ~ {max(fire_lons):.4f}")
        print(f"🔥 화재 날짜: {min(fire_dates).date()} ~ {max(fire_dates).date()}")

    # NASA 데이터 분석
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

def merge_historical_fire_nasa():
    """과거 화재 데이터와 NASA 데이터 병합"""
    
    # 파일 경로 설정
    root_dir = os.path.dirname(os.path.abspath(__file__))
    base_dir = os.path.abspath(os.path.join(root_dir, "..", "public", "data"))
    
    fire_input_path = os.path.join(base_dir, "korea_fire_2024_2025_with_weather.json")
    firms_input_path = os.path.join(base_dir, "nasa_firms_korea_2024_2025.json")
    output_path = os.path.join(base_dir, "korea_fire_full_2024_2025.json")

    # 파일 존재 확인
    if not os.path.exists(fire_input_path):
        print(f"❌ 화재 데이터 파일 없음: {fire_input_path}")
        return
    
    if not os.path.exists(firms_input_path):
        print(f"❌ NASA 데이터 파일 없음: {firms_input_path}")
        return

    # 데이터 로드
    with open(fire_input_path, "r", encoding="utf-8") as f:
        fires = json.load(f)
    
    with open(firms_input_path, "r", encoding="utf-8") as f:
        firms = json.load(f)

    # 기존 처리된 데이터 확인
    if os.path.exists(output_path):
        with open(output_path, "r", encoding="utf-8") as f:
            existing_data = json.load(f)
        existing_map = {e.get("frfr_info_id"): e for e in existing_data if e.get("frfr_info_id")}
        print(f"🔄 기존 처리된 데이터: {len(existing_map)}개")
    else:
        existing_map = {}

    print(f"🔥 화재 데이터: {len(fires)}개")
    print(f"🛰️ NASA FIRMS 데이터: {len(firms)}개")
    
    # 데이터 범위 분석
    analyze_data_ranges(fires, firms)

    enriched = []
    matched = 0
    skipped = 0
    total_processed = 0
    distance_thresholds = [5.0, 10.0, 20.0, 50.0]

    print(f"\n🔍 화재 데이터와 NASA 데이터 매칭 시작...")

    for i, fire in enumerate(fires, 1):
        fire_id = fire.get("frfr_info_id")
        
        # 기존 처리된 데이터 건너뛰기
        if fire_id and fire_id in existing_map:
            existing_fire = existing_map[fire_id]
            # NASA 데이터가 이미 추가되어 있는지 확인
            if existing_fire.get("brightness") is not None or existing_fire.get("nasa_distance_km") is not None:
                print(f"[{i}/{len(fires)}] 🛑 이미 처리됨 → 건너뜀: {fire_id}")
                enriched.append(existing_fire)
                skipped += 1
                continue

        # 화재 데이터 파싱
        try:
            lat, lon = get_fire_coordinates(fire)
            fire_date = parse_fire_date(fire)
            
            if not fire_date or not lat or not lon:
                print(f"[{i}/{len(fires)}] ⚠️ 화재 데이터 부족: lat={lat}, lon={lon}, date={fire_date}")
                fire["brightness"] = None
                fire["frp"] = None
                fire["confidence"] = None
                fire["satellite"] = None
                fire["instrument"] = None
                fire["nasa_distance_km"] = None
                fire["nasa_match_threshold"] = None
                enriched.append(fire)
                continue

            total_processed += 1
            print(f"[{i}/{len(fires)}] 🔍 화재: ({lat:.4f}, {lon:.4f}) at {fire_date.date()}", end=" ")

        except Exception as e:
            print(f"[{i}/{len(fires)}] ❌ 화재 데이터 파싱 오류: {e}")
            fire["brightness"] = None
            fire["frp"] = None
            fire["confidence"] = None
            fire["satellite"] = None
            fire["instrument"] = None
            fire["nasa_distance_km"] = None
            fire["nasa_match_threshold"] = None
            enriched.append(fire)
            continue

        # NASA 데이터와 매칭
        closest = None
        min_dist = float("inf")
        candidates = []

        for firm in firms:
            try:
                firm_date = datetime.strptime(firm["acq_date"], "%Y-%m-%d")
                
                # 날짜 차이 확인 (±3일 이내)
                date_diff = abs((firm_date - fire_date).days)
                if date_diff > 3:
                    continue
                
                firm_lat = float(firm["latitude"])
                firm_lon = float(firm["longitude"])
                dist = haversine(lat, lon, firm_lat, firm_lon)
                
                # 50km 이내 후보만 고려
                if dist <= 50.0:
                    candidates.append({
                        'firm': firm, 
                        'distance': dist,
                        'date_diff': date_diff
                    })
                
                # 최단 거리 업데이트
                if dist < min_dist:
                    min_dist = dist
                    closest = firm
                    
            except Exception:
                continue

        print(f"→ 후보 {len(candidates)}개", end=" ")

        # 매칭 결과 처리
        matched_threshold = next((t for t in distance_thresholds if min_dist <= t), None)
        
        if closest and matched_threshold:
            fire["brightness"] = float(closest.get("bright_ti4", 0)) if closest.get("bright_ti4") else None
            fire["frp"] = float(closest.get("frp", 0)) if closest.get("frp") else None
            fire["confidence"] = closest.get("confidence", "")
            fire["satellite"] = closest.get("satellite", "")
            fire["instrument"] = closest.get("instrument", "")
            fire["nasa_distance_km"] = round(min_dist, 2)
            fire["nasa_match_threshold"] = matched_threshold
            matched += 1
            print(f"✅ 매칭 (거리: {min_dist:.2f}km)")
        else:
            fire["brightness"] = None
            fire["frp"] = None
            fire["confidence"] = None
            fire["satellite"] = None
            fire["instrument"] = None
            fire["nasa_distance_km"] = None
            fire["nasa_match_threshold"] = None
            print("❌ 매칭 실패")

        enriched.append(fire)

    # 결과 저장
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(enriched, f, ensure_ascii=False, indent=2)

    print(f"\n✅ 병합 완료!")
    print(f"📁 저장 위치: {output_path}")
    print(f"📊 총 처리: {len(enriched)}개")
    print(f"🎯 NASA 매칭: {matched}/{total_processed}개 ({matched/max(total_processed,1)*100:.1f}%)")
    print(f"⏭️ 기존 건너뜀: {skipped}개")

    # 거리별 매칭 통계
    stats = {}
    for f in enriched:
        t = f.get("nasa_match_threshold")
        if t:
            stats[t] = stats.get(t, 0) + 1
    
    if stats:
        print("\n📊 거리별 매칭 통계:")
        for k in sorted(stats):
            print(f"   {k}km 이내: {stats[k]}개")

    # 샘플 데이터 출력
    sample_with_nasa = next((fire for fire in enriched if fire.get("nasa_distance_km")), None)
    if sample_with_nasa:
        print(f"\n📋 NASA 매칭 샘플:")
        print(f"  화재 ID: {sample_with_nasa.get('frfr_info_id')}")
        print(f"  주소: {sample_with_nasa.get('addr', 'N/A')}")
        print(f"  거리: {sample_with_nasa.get('nasa_distance_km')}km")
        print(f"  밝기: {sample_with_nasa.get('brightness')}")
        print(f"  신뢰도: {sample_with_nasa.get('confidence')}")
        print(f"  위성: {sample_with_nasa.get('satellite')}")

if __name__ == "__main__":
    merge_historical_fire_nasa()