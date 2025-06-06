import os
import json
from datetime import datetime, timedelta
from math import radians, cos, sin, sqrt, atan2

def haversine(lat1, lon1, lat2, lon2):
    """두 지점 간의 거리를 km 단위로 계산"""
    R = 6371
    d_lat = radians(lat2 - lat1)
    d_lon = radians(lon2 - lon1)
    a = sin(d_lat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(d_lon / 2) ** 2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return R * c

def parse_fire_date(date_str):
    """화재 날짜 파싱 (여러 형식 지원)"""
    if not date_str:
        return None
    
    try:
        # "2025-06-05 13:26" 형식이면 날짜 부분만 추출
        if ' ' in date_str:
            date_part = date_str.split(' ')[0]
        else:
            date_part = date_str
        
        # YYYY-MM-DD 형식 파싱
        if '-' in date_part and len(date_part) == 10:
            return datetime.strptime(date_part, "%Y-%m-%d")
        
        # YYYYMMDD 형식 파싱
        if len(date_part) == 8 and date_part.isdigit():
            return datetime.strptime(date_part, "%Y%m%d")
            
    except Exception as e:
        pass
    
    print(f"⚠️ 날짜 파싱 실패: {date_str}")
    return None

def analyze_data_ranges(fires, firms):
    """데이터 범위 분석"""
    print("\n📊 데이터 분석:")
    
    # 화재 데이터 분석
    fire_lats = []
    fire_lons = []
    fire_dates = []
    
    for fire in fires:
        try:
            lat = float(fire.get("frfr_lctn_ycrd", 0))
            lon = float(fire.get("frfr_lctn_xcrd", 0))
            
            # 날짜 파싱 시도
            date_str = fire.get("frfr_frng_dtm", "") or fire.get("frfr_sttmn_dt", "")
            fire_date = parse_fire_date(date_str)
            
            if lat and lon and fire_date:
                fire_lats.append(lat)
                fire_lons.append(lon)
                fire_dates.append(fire_date)
                
        except Exception as e:
            continue
    
    if fire_lats:
        print(f"🔥 화재 위도 범위: {min(fire_lats):.4f} ~ {max(fire_lats):.4f}")
        print(f"🔥 화재 경도 범위: {min(fire_lons):.4f} ~ {max(fire_lons):.4f}")
        print(f"🔥 화재 날짜 범위: {min(fire_dates).date()} ~ {max(fire_dates).date()}")
    
    # NASA FIRMS 데이터 분석
    firms_lats = []
    firms_lons = []
    firms_dates = []
    
    for firm in firms:
        try:
            lat = float(firm["latitude"])
            lon = float(firm["longitude"])
            firm_date = datetime.strptime(firm["acq_date"], "%Y-%m-%d")
            
            firms_lats.append(lat)
            firms_lons.append(lon)
            firms_dates.append(firm_date)
        except:
            continue
    
    if firms_lats:
        print(f"🛰️ NASA 위도 범위: {min(firms_lats):.4f} ~ {max(firms_lats):.4f}")
        print(f"🛰️ NASA 경도 범위: {min(firms_lons):.4f} ~ {max(firms_lons):.4f}")
        print(f"🛰️ NASA 날짜 범위: {min(firms_dates).date()} ~ {max(firms_dates).date()}")

def augment_firms_improved():
    """개선된 화재 데이터 매칭"""
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

    print(f"🔥 화재 항목: {len(fires)}개")
    print(f"🛰️ NASA 포인트: {len(firms)}개")
    
    # 데이터 범위 분석
    analyze_data_ranges(fires, firms)

    matched = 0
    total_processed = 0
    
    # 거리 임계값을 점진적으로 확대해서 테스트
    distance_thresholds = [5.0, 10.0, 20.0, 50.0]
    
    for fire in fires:
        try:
            lat = float(fire.get("frfr_lctn_ycrd", 0))
            lon = float(fire.get("frfr_lctn_xcrd", 0))
            
            # 여러 날짜 필드 시도
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
                
                # 날짜 차이 확대 (±3일)
                date_diff = abs((firm_date - fire_date).days)
                if date_diff > 3:
                    continue

                firm_lat = float(firm["latitude"])
                firm_lon = float(firm["longitude"])
                dist = haversine(lat, lon, firm_lat, firm_lon)
                
                # 후보 목록에 추가 (거리 50km 이내)
                if dist <= 50.0:
                    candidates.append({
                        'firm': firm,
                        'distance': dist,
                        'date_diff': date_diff
                    })
                
                # 가장 가까운 것 찾기
                if dist < min_dist:
                    min_dist = dist
                    closest = firm
                    
            except Exception as e:
                continue

        print(f"   📍 후보 {len(candidates)}개 발견, 최단거리: {min_dist:.2f}km")
        
        # 거리별 매칭 시도
        matched_threshold = None
        for threshold in distance_thresholds:
            if min_dist <= threshold:
                matched_threshold = threshold
                break
        
        if closest and matched_threshold:
            # NASA FIRMS 데이터 구조에 맞게 필드 매핑
            fire["brightness"] = float(closest.get("bright_ti4", 0))  # 열적외선 밝기
            fire["frp"] = float(closest.get("frp", 0))  # Fire Radiative Power
            fire["confidence"] = closest.get("confidence", "")  # 신뢰도 (h/n/l)
            fire["satellite"] = closest.get("satellite", "")  # 위성명
            fire["instrument"] = closest.get("instrument", "")  # 센서명
            fire["nasa_distance_km"] = round(min_dist, 2)
            fire["nasa_match_threshold"] = matched_threshold
            matched += 1
            print(f"   ✅ 매칭 성공! (거리: {min_dist:.2f}km, 임계값: {matched_threshold}km)")
            print(f"      FRP: {closest.get('frp', 'N/A')}MW, 신뢰도: {closest.get('confidence', 'N/A')}")
        else:
            fire["brightness"] = None
            fire["frp"] = None
            fire["confidence"] = None
            fire["satellite"] = None
            fire["instrument"] = None
            fire["nasa_distance_km"] = None
            fire["nasa_match_threshold"] = None
            print(f"   ❌ 매칭 실패 (최단거리: {min_dist:.2f}km)")
            
        # 가장 가까운 후보들 출력
        if candidates:
            candidates.sort(key=lambda x: x['distance'])
            print(f"   📋 가까운 후보 3개:")
            for i, cand in enumerate(candidates[:3]):
                firm = cand['firm']
                print(f"      {i+1}. {cand['distance']:.2f}km, {cand['date_diff']}일차이, "
                      f"({firm['latitude']}, {firm['longitude']}) at {firm['acq_date']}")

    # 결과 저장
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(fires, f, ensure_ascii=False, indent=2)

    print(f"\n✅ 병합 완료 → {output_path}")
    print(f"📌 NASA 데이터 매칭된 항목: {matched}/{total_processed}개 ({matched/max(total_processed,1)*100:.1f}%)")
    
    # 거리별 통계
    distance_stats = {}
    for fire in fires:
        threshold = fire.get("nasa_match_threshold")
        if threshold:
            distance_stats[threshold] = distance_stats.get(threshold, 0) + 1
    
    if distance_stats:
        print(f"📊 거리별 매칭 통계:")
        for threshold in sorted(distance_stats.keys()):
            print(f"   {threshold}km 이내: {distance_stats[threshold]}개")

if __name__ == "__main__":
    augment_firms_improved()