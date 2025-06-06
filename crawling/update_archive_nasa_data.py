import os
import json
import csv
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
    date_fields = ["occu_dtm", "frfr_frng_dtm", "frfr_sttmn_dt"]
    
    for field in date_fields:
        date_str = fire_data.get(field, "")
        if not date_str:
            continue
            
        try:
            if ' ' in date_str:
                date_part = date_str.split(' ')[0]
            else:
                date_part = date_str
            
            if '-' in date_part and len(date_part) == 10:
                return datetime.strptime(date_part, "%Y-%m-%d")
            
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

def csv_to_json(csv_file_path):
    """CSV 파일을 JSON으로 변환"""
    print(f"📁 CSV 파일 읽는 중: {csv_file_path}")
    
    nasa_data = []
    with open(csv_file_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            # 데이터 타입 변환
            try:
                nasa_point = {
                    'latitude': float(row['latitude']),
                    'longitude': float(row['longitude']),
                    'brightness': float(row['brightness']) if row['brightness'] else None,
                    'acq_date': row['acq_date'],
                    'acq_time': int(row['acq_time']) if row['acq_time'] else None,
                    'satellite': row['satellite'],
                    'instrument': row['instrument'],
                    'confidence': row['confidence'],
                    'frp': float(row['frp']) if row['frp'] else None,
                    'bright_t31': float(row['bright_t31']) if row['bright_t31'] else None,
                    'daynight': row['daynight'],
                    'type': int(row['type']) if row['type'] else None
                }
                nasa_data.append(nasa_point)
            except (ValueError, KeyError) as e:
                print(f"⚠️ 데이터 변환 오류: {e}")
                continue
    
    print(f"✅ NASA 데이터 로딩 완료: {len(nasa_data)}개")
    return nasa_data

def update_fire_data_with_archive(fire_json_path, nasa_csv_path, output_path):
    """기존 화재 데이터에 NASA 아카이브 데이터 추가"""
    
    # 1. 기존 화재 데이터 로드
    print(f"📂 기존 화재 데이터 로딩: {fire_json_path}")
    with open(fire_json_path, 'r', encoding='utf-8') as f:
        fire_data = json.load(f)
    
    print(f"🔥 기존 화재 데이터: {len(fire_data)}개")
    
    # 2. NASA 아카이브 데이터 변환 및 로드
    nasa_data = csv_to_json(nasa_csv_path)
    
    # 3. NASA 데이터가 없는 화재만 필터링
    fires_without_nasa = []
    fires_with_nasa = []
    
    for fire in fire_data:
        has_nasa = (
            fire.get('brightness') is not None or 
            fire.get('nasa_distance_km') is not None or
            fire.get('frp') is not None
        )
        
        if has_nasa:
            fires_with_nasa.append(fire)
        else:
            fires_without_nasa.append(fire)
    
    print(f"🔍 NASA 데이터 없는 화재: {len(fires_without_nasa)}개")
    print(f"✅ NASA 데이터 있는 화재: {len(fires_with_nasa)}개")
    
    # 4. NASA 데이터 없는 화재들과 아카이브 데이터 매칭
    print(f"\n🔄 NASA 아카이브 데이터와 매칭 시작...")
    
    updated_fires = fires_with_nasa.copy()  # 기존 NASA 데이터 있는 것들은 그대로 유지
    new_matches = 0
    distance_thresholds = [5.0, 10.0, 20.0, 50.0]
    
    for i, fire in enumerate(fires_without_nasa, 1):
        print(f"[{i}/{len(fires_without_nasa)}] 처리 중...", end=" ")
        
        # 화재 정보 파싱
        fire_lat, fire_lon = get_fire_coordinates(fire)
        fire_date = parse_fire_date(fire)
        
        if not (fire_lat and fire_lon and fire_date):
            print("❌ 좌표/날짜 부족")
            updated_fires.append(fire)
            continue
        
        # NASA 데이터와 매칭
        closest = None
        min_dist = float("inf")
        candidates = []
        
        for nasa_point in nasa_data:
            try:
                nasa_date = datetime.strptime(nasa_point["acq_date"], "%Y-%m-%d")
                
                # 날짜 차이 확인 (±3일 이내)
                date_diff = abs((nasa_date - fire_date).days)
                if date_diff > 3:
                    continue
                
                nasa_lat = nasa_point["latitude"]
                nasa_lon = nasa_point["longitude"]
                dist = haversine(fire_lat, fire_lon, nasa_lat, nasa_lon)
                
                # 50km 이내 후보만 고려
                if dist <= 50.0:
                    candidates.append({
                        'nasa': nasa_point, 
                        'distance': dist,
                        'date_diff': date_diff
                    })
                
                # 최단 거리 업데이트
                if dist < min_dist:
                    min_dist = dist
                    closest = nasa_point
                    
            except Exception:
                continue
        
        # 매칭 결과 처리
        matched_threshold = next((t for t in distance_thresholds if min_dist <= t), None)
        
        if closest and matched_threshold:
            # NASA 데이터 추가
            fire["brightness"] = closest.get("brightness")
            fire["frp"] = closest.get("frp")
            fire["confidence"] = closest.get("confidence", "")
            fire["satellite"] = closest.get("satellite", "")
            fire["instrument"] = closest.get("instrument", "")
            fire["nasa_distance_km"] = round(min_dist, 2)
            fire["nasa_match_threshold"] = matched_threshold
            fire["bright_t31"] = closest.get("bright_t31")
            fire["nasa_acq_time"] = closest.get("acq_time")
            fire["nasa_daynight"] = closest.get("daynight")
            
            new_matches += 1
            print(f"✅ 매칭 (거리: {min_dist:.2f}km, 후보: {len(candidates)}개)")
        else:
            # 매칭 실패 - 기본값 설정
            fire["brightness"] = None
            fire["frp"] = None
            fire["confidence"] = None
            fire["satellite"] = None
            fire["instrument"] = None
            fire["nasa_distance_km"] = None
            fire["nasa_match_threshold"] = None
            print("❌ 매칭 실패")
        
        updated_fires.append(fire)
    
    # 5. 결과 저장
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(updated_fires, f, ensure_ascii=False, indent=2)
    
    # 6. 결과 요약
    total_with_nasa = len([f for f in updated_fires if f.get('nasa_distance_km') is not None])
    
    print(f"\n✅ 업데이트 완료!")
    print(f"📁 저장 위치: {output_path}")
    print(f"📊 총 화재 데이터: {len(updated_fires)}개")
    print(f"🆕 신규 NASA 매칭: {new_matches}개")
    print(f"🎯 전체 NASA 매칭: {total_with_nasa}개 ({total_with_nasa/len(updated_fires)*100:.1f}%)")
    
    # 거리별 통계 (신규 매칭만)
    new_matches_by_distance = {}
    for fire in fires_without_nasa:
        threshold = fire.get("nasa_match_threshold")
        if threshold:
            new_matches_by_distance[threshold] = new_matches_by_distance.get(threshold, 0) + 1
    
    if new_matches_by_distance:
        print(f"\n📊 신규 매칭 거리별 통계:")
        for distance in sorted(new_matches_by_distance.keys()):
            count = new_matches_by_distance[distance]
            print(f"   {distance}km 이내: {count}개")

def main():
    """메인 실행 함수"""
    # 파일 경로 설정
    root_dir = os.path.dirname(os.path.abspath(__file__))
    base_dir = os.path.join(root_dir, "..", "public", "data")
    
    # 입력 파일
    fire_json_path = os.path.join(base_dir, "korea_fire_full_2024_2025.json")
    nasa_csv_path = os.path.join(root_dir, "fire2024100120250401.csv")  # 다운로드한 CSV 파일
    
    # 출력 파일
    output_path = os.path.join(base_dir, "korea_fire_enhanced_2024_2025.json")
    
    # 파일 존재 확인
    if not os.path.exists(fire_json_path):
        print(f"❌ 화재 데이터 파일 없음: {fire_json_path}")
        return
    
    if not os.path.exists(nasa_csv_path):
        print(f"❌ NASA CSV 파일 없음: {nasa_csv_path}")
        print(f"💡 NASA FIRMS 아카이브에서 다운로드한 CSV 파일을 다음 위치에 저장하세요:")
        print(f"   {nasa_csv_path}")
        return
    
    print("🚀 NASA 아카이브 데이터 통합 시작!")
    print("=" * 50)
    
    # 데이터 통합 실행
    update_fire_data_with_archive(fire_json_path, nasa_csv_path, output_path)
    
    print("=" * 50)
    print("🎉 모든 작업이 완료되었습니다!")

if __name__ == "__main__":
    main()