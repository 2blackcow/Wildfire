let viewer;
let currentFireData = []; // 현재 표시중인 화재 데이터 저장

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

// 🔥 화재 리스트 업데이트 함수
function updateFireList(fireItems) {
  const fireListContainer = document.getElementById("fireList");
  if (!fireListContainer) return;

  if (fireItems.length === 0) {
    fireListContainer.innerHTML = '<div style="color: #999; text-align: center; padding: 20px;">선택된 기간에 화재가 없습니다</div>';
    return;
  }

  // 날짜별로 그룹화
  const groupedByDate = {};
  fireItems.forEach(item => {
    const fireStartTime = item.frfr_frng_dtm || item.start || item.date;
    const dateStr = fireStartTime?.split(' ')[0] || fireStartTime?.split('T')[0];
    if (!groupedByDate[dateStr]) {
      groupedByDate[dateStr] = [];
    }
    groupedByDate[dateStr].push(item);
  });

  let html = '';
  
  // 날짜별로 정렬하여 표시 (최신순)
  Object.keys(groupedByDate)
    .sort((a, b) => new Date(b) - new Date(a))
    .forEach(dateStr => {
      const dayFires = groupedByDate[dateStr];
      
      // 날짜 헤더
      html += `<div class="date-separator">📅 ${dateStr} (${dayFires.length}건)</div>`;
      
      dayFires.forEach((fire, index) => {
        const level = fire.frfr_step_issu_cd || fire.level || '미분류';
        const status = fire.frfr_prgrs_stcd_str || fire.status || '상태미상';
        const address = fire.frfr_sttmn_addr || fire.frfr_sttm_addr || fire.address || '주소불명';
        const fireStartTime = fire.frfr_frng_dtm || fire.start || fire.date;
        const time = fireStartTime?.split(' ')[1]?.substring(0, 5) || '';
        const lat = fire.frfr_lctn_ycrd || fire.lat || fire.latitude;
        const lon = fire.frfr_lctn_xcrd || fire.lon || fire.longitude;
        
        // 대응단계별 아이콘
        const levelIcon = level === "초기대응" ? '<span style="color: #ffd700;">●</span>' :
                         level === "1단계" ? '<span style="color: #ff8c00;">●</span>' :
                         level === "2단계" ? '<span style="color: #ff6666;">●</span>' :
                         level === "3단계" ? '<span style="color: #800080;">●</span>' : '●';
        
        // 진행상태별 아이콘
        const statusIcon = status === "진화중" ? '🔥' :
                          status === "진화완료" ? '🧯' : '🔥';
        
        // 주소를 간략하게 표시
        const shortAddress = address.length > 20 ? address.substring(0, 20) + '...' : address;
        
        html += `
          <div class="fire-item level-${level}" 
               data-lat="${lat}" 
               data-lon="${lon}"
               data-entity-id="fire-${index}-${dateStr}"
               data-fire-index="${fireItems.indexOf(fire)}">
            <div class="fire-item-header">${shortAddress}</div>
            <div class="fire-item-details">
              🕒 ${time} | ${levelIcon} ${level} | ${statusIcon} ${status}
            </div>
          </div>
        `;
      });
    });

  fireListContainer.innerHTML = html;

  // 클릭 이벤트 추가 - 해당 화재 위치로 카메라 이동
  fireListContainer.querySelectorAll('.fire-item').forEach(item => {
    item.addEventListener('click', () => {
      const lat = parseFloat(item.dataset.lat);
      const lon = parseFloat(item.dataset.lon);
      const fireIndex = parseInt(item.dataset.fireIndex);
      
      if (!isNaN(lat) && !isNaN(lon)) {
        // 카메라 이동
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(lon, lat, 5000),
          duration: 2.0
        });
        
        // 해당 엔티티 하이라이트 (선택)
        const fireItem = fireItems[fireIndex];
        if (fireItem) {
          // 모든 엔티티를 확인하여 해당 화재 찾기
          const entities = viewer.entities.values;
          for (let entity of entities) {
            if (entity.position) {
              const entityPos = entity.position.getValue(Cesium.JulianDate.now());
              const entityCart = Cesium.Cartographic.fromCartesian(entityPos);
              const entityLat = Cesium.Math.toDegrees(entityCart.latitude);
              const entityLon = Cesium.Math.toDegrees(entityCart.longitude);
              
              // 좌표가 일치하는 엔티티 찾기 (소수점 4자리까지 비교)
              if (Math.abs(entityLat - lat) < 0.0001 && Math.abs(entityLon - lon) < 0.0001) {
                viewer.selectedEntity = entity;
                setTimeout(() => {
                  if (viewer.selectedEntity === entity) {
                    viewer.selectedEntity = null;
                  }
                }, 4000);
                break;
              }
            }
          }
        }
      }
    });
  });
}

// 한국 화재 데이터 로딩 및 시각화
async function loadKoreaFireData() {
  try {
    // 상대 경로로 JSON 파일 접근
    const res = await fetch("../../../data/korea_fire_2024_2025_with_weather.json");
    const fireData = await res.json();

    console.log(`📊 전체 화재 데이터 ${fireData.length}개 로드됨`);

    // 2024년 10월 데이터만 필터링
    const october2024Data = fireData.filter(item => {
      // JSON 구조에 맞는 날짜 필드 확인
      const dateField = item.frfr_frng_dtm || item.start || item.date;
      if (!dateField) return false;
      
      const dataDate = new Date(dateField.split(" ")[0]);
      return dataDate >= new Date("2025-02-01") && dataDate <= new Date("2025-02-28");
    });

    console.log(`✅ 2025년 2월 화재 데이터 ${october2024Data.length}개 필터링됨`);
    
    if (october2024Data.length === 0) {
      console.warn("⚠️ 2025년 2월 데이터가 없습니다. 전체 데이터 구조를 확인합니다:");
      console.log("첫 번째 데이터 샘플:", fireData[0]);
      updateFireCount("2025년 2월 데이터 없음");
      updateFireList([]);
      return;
    }
    
    currentFireData = october2024Data; // 전역 변수에 저장
    renderFireData(october2024Data);
    setupDateRangeFilter(october2024Data);

  } catch (err) {
    console.error("❌ 화재 데이터 로딩 실패:", err);
    updateFireCount("데이터 로딩 실패");
    updateFireList([]);
    
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
        
        const october2024Data = fireData.filter(item => {
          const dateField = item.frfr_frng_dtm || item.start || item.date;
          if (!dateField) return false;
          
          const dataDate = new Date(dateField.split(" ")[0]);
          return dataDate >= new Date("2025-02-01") && dataDate <= new Date("2025-02-28");
        });

        console.log(`📅 2025년 2월 데이터: ${october2024Data.length}개`);
        
        if (october2024Data.length > 0) {
          currentFireData = october2024Data;
          renderFireData(october2024Data);
          setupDateRangeFilter(october2024Data);
          return;
        }
      }
    } catch (err) {
      console.log(`❌ ${path} 실패:`, err.message);
    }
  }
  
  console.error("❌ 모든 경로 시도 실패");
  updateFireCount("JSON 파일을 찾을 수 없음");
  updateFireList([]);
}

// 화재 데이터 시각화
function renderFireData(fireData, startDate = "2025-02-01", endDate = "2025-02-28") {
  console.log(`🎯 renderFireData 호출됨 - 입력 데이터: ${fireData.length}개`);
  console.log("📊 첫 번째 데이터 샘플:", fireData[0]);
  
  viewer.entities.removeAll();

  const sDate = new Date(startDate);
  const eDate = new Date(endDate);
  let count = 0;
  let filteredFireData = [];

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
    
    const dataDateStr = fireStartTime.split(" ")[0];
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

    filteredFireData.push(item); // 필터링된 데이터에 추가

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
          📍 <b>주소:</b> ${address}<br/>
          🧨 <b>발생일시:</b> ${fireStartTime || "-"}<br/>
          ${fireEndTime ? `🕒 <b>진화일시:</b> ${fireEndTime}<br/>` : ''}
          🔥 <b>진행상태:</b> ${status}<br/>
          🧯 <b>대응단계:</b> ${level}<br/><br/>
          🌡️ <b>기온:</b> ${temp ?? "-"} ℃<br/>
          💨 <b>풍속:</b> ${wspd ?? "-"} m/s<br/>
          🧭 <b>풍향:</b> ${wdir ?? "-"}°<br/>
          ☔ <b>강수량:</b> ${precip ?? "-"} mm<br/>
          💧 <b>습도:</b> ${rhum ?? "-"} %<br/>
        `,
      });

      console.log(`✅ 엔티티 ${count + 1} 생성 완료:`, entity.id);
      count++;

    } catch (error) {
      console.error(`❌ 엔티티 생성 실패:`, error);
    }
  });

  updateFireCount(count);
  updateFireList(filteredFireData); // 화재 리스트 업데이트
  console.log(`🎯 최종 결과: ${count}개 화재 지점 시각화 완료`);
  
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

    if (sDate < new Date("2025-02-01") || eDate > new Date("2025-02-28")) {
      alert("2025년 2월 범위 내에서만 선택 가능합니다.");
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