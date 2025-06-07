let viewer;

async function init() {
  viewer = new Cesium.Viewer("cesiumContainer", {
    geocoder: true,
    baseLayerPicker: true,
    sceneModePicker: true,
    timeline: false,
    animation: false,
    terrain: Cesium.Terrain.fromWorldTerrain(),
  });

  viewer.scene.skyAtmosphere.show = true;
  viewer.scene.globe.enableLighting = true;

  // 한국 중심으로 카메라 설정
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(127.7669, 35.9078, 600000.0),
  });

  loadKoreaFireData();
  setupDateControls();
}

// 단계별 스타일 지정
function getVisualStyleByLevel(level) {
  switch (level) {
    case "초기대응":
      return {
        color: Cesium.Color.YELLOW.withAlpha(0.8),
        size: 12,
      };
    case "1단계":
      return {
        color: Cesium.Color.ORANGE.withAlpha(0.85),
        size: 18,
      };
    case "2단계":
      return {
        color: Cesium.Color.fromCssColorString("#ff6666").withAlpha(0.9),
        size: 22,
      };
    case "3단계":
      return {
        color: Cesium.Color.fromCssColorString("#800080").withAlpha(1.0),
        size: 26,
      };
    default:
      return {
        color: Cesium.Color.GRAY.withAlpha(0.6),
        size: 12,
      };
  }
}

// 한국 화재 데이터 로딩 및 시각화
async function loadKoreaFireData() {
  try {
    // 상대 경로로 JSON 파일 접근 (korea_past/2024/11/ 에서 루트의 data 폴더로)
    const res = await fetch("../../../data/korea_fire_2024_2025_with_weather.json");
    const fireData = await res.json();

    console.log(`📊 전체 화재 데이터 ${fireData.length}개 로드됨`);

    // 2024년 11월 데이터만 필터링
    const november2024Data = fireData.filter(item => {
      // JSON 구조에 맞는 날짜 필드 확인
      const dateField = item.frfr_frng_dtm || item.start || item.date;
      if (!dateField) return false;
      
      const dataDate = new Date(dateField.split(" ")[0]); // "2024-11-13 11:02"에서 날짜 부분만 추출
      return dataDate >= new Date("2024-11-01") && dataDate <= new Date("2024-11-30");
    });

    console.log(`✅ 2024년 11월 화재 데이터 ${november2024Data.length}개 필터링됨`);
    
    if (november2024Data.length === 0) {
      console.warn("⚠️ 2024년 11월 데이터가 없습니다. 전체 데이터 구조를 확인합니다:");
      console.log("첫 번째 데이터 샘플:", fireData[0]);
      updateFireCount("2024년 11월 데이터 없음");
      return;
    }
    
    renderFireData(november2024Data);
    setupDateRangeFilter(november2024Data);

  } catch (err) {
    console.error("❌ 화재 데이터 로딩 실패:", err);
    updateFireCount("데이터 로딩 실패");
    
    // 대체 경로들로 시도
    console.log("🔄 대체 경로로 재시도 중...");
    await tryAlternatePaths();
  }
}

// 대체 경로들로 시도하는 함수
async function tryAlternatePaths() {
  const alternatePaths = [
    "/data/korea_fire_2024_2025_with_weather.json",
    "../../data/korea_fire_2024_2025_with_weather.json",
    "../data/korea_fire_2024_2025_with_weather.json",
    "data/korea_fire_2024_2025_with_weather.json",
    "/korea_fire_2024_2025_with_weather.json"
  ];

  for (const path of alternatePaths) {
    try {
      console.log(`🔍 시도 중: ${path}`);
      const res = await fetch(path);
      if (res.ok) {
        const fireData = await res.json();
        console.log(`✅ 성공! ${path}에서 ${fireData.length}개 데이터 로드됨`);
        
        const november2024Data = fireData.filter(item => {
          const dateField = item.frfr_frng_dtm || item.start || item.date;
          if (!dateField) return false;
          
          const dataDate = new Date(dateField.split(" ")[0]);
          return dataDate >= new Date("2024-11-01") && dataDate <= new Date("2024-11-30");
        });

        console.log(`📅 2024년 11월 데이터: ${november2024Data.length}개`);
        
        if (november2024Data.length > 0) {
          renderFireData(november2024Data);
          setupDateRangeFilter(november2024Data);
          return;
        }
      }
    } catch (err) {
      console.log(`❌ ${path} 실패:`, err.message);
    }
  }
  
  console.error("❌ 모든 경로 시도 실패");
  updateFireCount("JSON 파일을 찾을 수 없음");
}

// 화재 데이터 시각화
function renderFireData(fireData, startDate = "2024-11-01", endDate = "2024-11-30") {
  console.log(`🎯 renderFireData 호출됨 - 입력 데이터: ${fireData.length}개`);
  console.log("📊 첫 번째 데이터 샘플:", fireData[0]);
  
  viewer.entities.removeAll();

  const sDate = new Date(startDate);
  const eDate = new Date(endDate);
  let count = 0;

  fireData.forEach((item, index) => {
    console.log(`🔍 데이터 ${index + 1} 처리 중:`, item);
    
    // JSON 구조에 맞는 필드명 사용
    const fireStartTime = item.frfr_frng_dtm || item.start || item.date;
    const fireEndTime = item.potfr_end_dtm || item.time || item.end_time;
    const address = item.frfr_sttmn_addr || item.frfr_sttm_addr || item.address || '위치 정보 없음';
    const status = item.frfr_prgrs_stcd_str || item.status || '정보 없음';
    const level = item.frfr_step_issu_cd || item.level || '정보 없음';
    const lat = item.frfr_lctn_ycrd || item.lat || item.latitude;
    const lon = item.frfr_lctn_xcrd || item.lon || item.longitude;
    
    // 기상 데이터
    const temp = item.temp;
    const wspd = item.wspd;
    const wdir = item.wdir;
    const precip = item.precip;
    const rhum = item.rhum;

    // 날짜 필터링
    if (!fireStartTime) {
      console.warn(`⚠️ 데이터 ${index + 1}: 시작 시간 필드가 없음`);
      return;
    }
    
    const dataDateStr = fireStartTime.split(" ")[0]; // "2024-11-13 11:02"에서 "2024-11-13" 추출
    const dataDate = new Date(dataDateStr);
    console.log(`📅 데이터 날짜: ${dataDateStr}, 필터 범위: ${startDate} ~ ${endDate}`);
    
    if (dataDate < sDate || dataDate > eDate) {
      console.log(`❌ 날짜 범위 밖: ${dataDateStr}`);
      return;
    }

    // 위치 정보 확인
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);
    
    console.log(`📍 위치 정보: lat=${latitude}, lon=${longitude}`);
    
    if (isNaN(latitude) || isNaN(longitude)) {
      console.error(`❌ 잘못된 좌표: lat=${lat}, lon=${lon}`);
      return;
    }

    // 한국 범위 체크 (대략적인 범위)
    if (latitude < 33 || latitude > 39 || longitude < 124 || longitude > 132) {
      console.warn(`⚠️ 한국 범위 밖 좌표: lat=${latitude}, lon=${longitude}`);
    }

    const style = getVisualStyleByLevel(level);
    console.log(`🎨 스타일 적용: level=${level}, color=${style.color}, size=${style.size}`);

    try {
      const entity = viewer.entities.add({
        id: `fire-${index}-${dataDateStr}`,
        position: Cesium.Cartesian3.fromDegrees(longitude, latitude, 1000), // 높이 1km로 설정
        point: {
          pixelSize: style.size,
          color: style.color,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          scaleByDistance: new Cesium.NearFarScalar(1000.0, 2.0, 500000.0, 0.5),
        },
        description: `
          <div style="font-family: 'Segoe UI', sans-serif; line-height: 1.6; background: rgba(0, 0, 0, 0.9); color: white; padding: 16px; border-radius: 8px; margin: -8px;">
            <h3 style="margin: 0 0 12px 0; color:rgb(255, 255, 255); font-size: 16px; border-bottom: 1px solid #333; padding-bottom: 8px;">🔥 화재 정보</h3>
            
            <div style="background: rgba(255, 255, 255, 0.1); padding: 12px; border-radius: 6px; margin-bottom: 12px; border: 1px solid rgba(255, 255, 255, 0.2);">
              <div style="margin-bottom: 6px;"><strong style="color: #ffd700;">📍 위치:</strong> <span style="color: #e0e0e0;">${address}</span></div>
              <div style="margin-bottom: 6px;"><strong style="color: #ffd700;">🧨 발생일시:</strong> <span style="color: #e0e0e0;">${fireStartTime || "-"}</span></div>
              <div style="margin-bottom: 6px;"><strong style="color: #ffd700;">🕒 진화일시:</strong> <span style="color: #e0e0e0;">${fireEndTime || "-"}</span></div>
              <div style="margin-bottom: 6px;"><strong style="color: #ffd700;">🔥 진행상태:</strong> <span style="color: #ff6b6b; font-weight: bold;">${status}</span></div>
              <div style="margin-bottom: 6px;"><strong style="color: #ffd700;">🧯 대응단계:</strong> <span style="color: #4fc3f7; font-weight: bold;">${level}</span></div>
              <div><strong style="color: #ffd700;">📊 좌표:</strong> <span style="color: #e0e0e0;">${latitude.toFixed(4)}, ${longitude.toFixed(4)}</span></div>
            </div>
            
            <div style="background: rgba(255, 255, 255, 0.1); padding: 12px; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.2);">
              <h4 style="margin: 0 0 8px 0; color:rgb(255, 255, 255); font-size: 14px;">🌤️ 기상 정보</h4>
              <div style="margin-bottom: 4px;"><strong style="color: #81c784;">🌡️ 기온:</strong> <span style="color: #e0e0e0;">${temp ?? "-"} ℃</span></div>
              <div style="margin-bottom: 4px;"><strong style="color: #81c784;">💨 풍속:</strong> <span style="color: #e0e0e0;">${wspd ?? "-"} m/s</span></div>
              <div style="margin-bottom: 4px;"><strong style="color: #81c784;">🧭 풍향:</strong> <span style="color: #e0e0e0;">${wdir ?? "-"}°</span></div>
              <div style="margin-bottom: 4px;"><strong style="color: #81c784;">☔ 강수량:</strong> <span style="color: #e0e0e0;">${precip ?? "-"} mm</span></div>
              <div><strong style="color: #81c784;">💧 습도:</strong> <span style="color: #e0e0e0;">${rhum ?? "-"} %</span></div>
            </div>
          </div>
        `,
      });

      console.log(`✅ 엔티티 ${count + 1} 생성 완료:`, entity.id);
      count++;

    } catch (error) {
      console.error(`❌ 엔티티 생성 실패:`, error);
    }
  });

  updateFireCount(count);
  console.log(`🎯 최종 결과: ${count}개 화재 지점 시각화 완료`);

  // 대한민국 전체 뷰 유지 (화재 지점으로 확대하지 않음)
  console.log(`🎯 카메라는 대한민국 전체 뷰 유지`);
  
  // 화재 지점이 있을 때만 부드럽게 약간 조정
  if (count > 0 && fireData.length > 0) {
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(127.7669, 35.9078, 800000), // 대한민국 중심, 높은 고도
      duration: 1.5
    });
  }
}

// 화재 개수 업데이트
function updateFireCount(count) {
  const fireCountDiv = document.getElementById("fireCount");
  if (typeof count === 'number') {
    fireCountDiv.textContent = `🔥 화재 지점 ${count.toLocaleString()}개 표시됨`;
  } else {
    fireCountDiv.textContent = count;
  }
}

// 날짜 범위 필터 설정
function setupDateRangeFilter(fireData) {
  const startInput = document.getElementById("startDate");
  const endInput = document.getElementById("endDate");

  const onRangeChange = () => {
    const startDate = startInput.value;
    const endDate = endInput.value;
    const sDate = new Date(startDate);
    const eDate = new Date(endDate);

    if (sDate > eDate) {
      alert("시작 날짜가 종료 날짜보다 늦을 수 없습니다.");
      return;
    }

    if (sDate < new Date("2024-11-01") || eDate > new Date("2024-11-30")) {
      alert("2024년 11월 범위 내에서만 선택 가능합니다.");
      return;
    }

    // 전체 데이터에서 다시 필터링
    const filteredData = fireData.filter(item => {
      const dateField = item.frfr_frng_dtm || item.start || item.date;
      if (!dateField) return false;
      
      const dataDate = new Date(dateField.split(" ")[0]);
      return dataDate >= sDate && dataDate <= eDate;
    });

    renderFireData(filteredData, startDate, endDate);
  };

  startInput.addEventListener("change", onRangeChange);
  endInput.addEventListener("change", onRangeChange);
}

// 날짜 컨트롤 설정
function setupDateControls() {
  // 마우스 클릭 시 상세 정보 표시
  viewer.screenSpaceEventHandler.setInputAction((click) => {
    const picked = viewer.scene.pick(click.position);
    if (Cesium.defined(picked) && picked.id?.description) {
      viewer.selectedEntity = picked.id;
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

  // 마우스 오버 시 정보 팝업 표시
  const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  handler.setInputAction((movement) => {
    const pickedObject = viewer.scene.pick(movement.endPosition);
    if (Cesium.defined(pickedObject) && pickedObject.id?.description) {
      document.body.style.cursor = 'pointer';
    } else {
      document.body.style.cursor = 'default';
    }
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
}

// 환경설정 및 초기화
fetch("/api/config")
  .then((res) => res.json())
  .then((config) => {
    Cesium.Ion.defaultAccessToken = config.cesiumToken;
    Cesium.GoogleMaps.defaultApiKey = config.googleKey;
    init();
  })
  .catch((err) => {
    console.error("❌ config 불러오기 실패:", err);
    // config 없이도 실행 가능하도록 기본 토큰 설정
    init();
  });