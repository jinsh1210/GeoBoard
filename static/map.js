// ─── Maptiler token ──────────────────────────────────────────────
const MAPTILER_TOKEN = "DNeUL0atKUPRxdOoxqFL";

// ─── Leaflet 2D 지도 ─────────────────────────────────────────────
const map = L.map("map").setView([37.455, 126.705], 12);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap",
}).addTo(map);

// ─── Maptiler SDK 3D 지도 ────────────────────────────────────────
maptilersdk.config.apiKey = MAPTILER_TOKEN;

const map3d = new maptilersdk.Map({
  container: "map3d",
  style: maptilersdk.MapStyle.STREETS.DARK,
  center: [126.705, 37.455],
  zoom: 15,
  pitch: 55,
  bearing: -20,
});

map3d.addControl(new maptilersdk.NavigationControl(), "top-right");

map3d.on("load", () => {
  // 스타일 내장 "Building 3D" 레이어 paint 덮어쓰기
  map3d.setPaintProperty("Building 3D", "fill-extrusion-color", [
    "interpolate", ["linear"],
    ["coalesce", ["get", "render_height"], 0],
    0,   "#1e3a5f",
    30,  "#2c7be5",
    60,  "#38bdf8",
    100, "#7dd3fc",
  ]);
  map3d.setPaintProperty("Building 3D", "fill-extrusion-opacity", 0.85);

  const BLDG_LAYER = "Building 3D";

  // 검색 결과 GeoJSON 핀 소스
  map3d.addSource("search-results", {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });

  map3d.addLayer({
    id: "search-pins",
    type: "fill-extrusion",
    source: "search-results",
    paint: {
      "fill-extrusion-color": "#ff4d4f",
      "fill-extrusion-height": 80,
      "fill-extrusion-base": 0,
      "fill-extrusion-opacity": 0.95,
    },
  });

  // 핀 라벨
  map3d.addLayer({
    id: "search-pin-labels",
    type: "symbol",
    source: "search-results",
    layout: {
      "text-field": ["get", "name"],
      "text-size": 12,
      "text-offset": [0, -1],
      "text-anchor": "bottom",
      "text-max-width": 8,
    },
    paint: {
      "text-color": "#ffffff",
      "text-halo-color": "#ff4d4f",
      "text-halo-width": 1.5,
    },
  });

  // 핀 클릭 → 정보 표시
  map3d.on("click", "search-pins", (e) => {
    const props = e.features[0].properties;
    showBuildingInfo({
      height: "검색 결과",
      levels: "-",
      type: props.type || "-",
      name: props.name || "",
      lngLat: e.lngLat,
    });
  });

  map3d.on("mouseenter", "search-pins", () => {
    map3d.getCanvas().style.cursor = "pointer";
  });
  map3d.on("mouseleave", "search-pins", () => {
    map3d.getCanvas().style.cursor = "";
  });

  // 건물 클릭 → 높이 정보 패널
  map3d.on("click", BLDG_LAYER, (e) => {
    const props = e.features[0].properties;
    showBuildingInfo({
      height: props.render_height ?? props.height ?? "정보 없음",
      levels: props.levels ?? props["building:levels"] ?? "-",
      type: props.class ?? props.type ?? "-",
      name: props.name ?? "",
      lngLat: e.lngLat,
    });
  });

  map3d.on("mouseenter", BLDG_LAYER, () => {
    map3d.getCanvas().style.cursor = "pointer";
  });
  map3d.on("mouseleave", BLDG_LAYER, () => {
    map3d.getCanvas().style.cursor = "";
  });
});

// ─── 상태 ─────────────────────────────────────────────────────────
let markers = [];
let currentLayer = "facilities";
let currentView = "2d";
let lastResults = [];

// ─── 뷰 전환 ─────────────────────────────────────────────────────
function switchView(view) {
  currentView = view;
  document.getElementById("btn-view-2d").classList.toggle("active", view === "2d");
  document.getElementById("btn-view-3d").classList.toggle("active", view === "3d");
  document.getElementById("btn-view-lane").classList.toggle("active", view === "lane");

  document.getElementById("map").style.display = view === "2d" ? "block" : "none";
  // 3D 뷰와 차선 안내 뷰 모두 map3d 인스턴스를 공유
  document.getElementById("map3d").style.display = (view === "3d" || view === "lane") ? "block" : "none";

  // 사이드바 필터 영역 전환
  document.getElementById("lane-inputs").style.display = view === "lane" ? "block" : "none";
  document.getElementById("keyword").style.display = view === "lane" ? "none" : "";
  document.getElementById("filter-facilities").style.display = (view !== "lane" && currentLayer === "facilities") ? "" : "none";
  document.getElementById("filter-restrooms").style.display = (view !== "lane" && currentLayer === "restrooms") ? "" : "none";
  document.querySelector("#sidebar > button:not(.view-btn):not(.toggle-btn)").style.display = view === "lane" ? "none" : "";
  document.getElementById("count").style.display = view === "lane" ? "none" : "";
  document.getElementById("list").style.display = view === "lane" ? "none" : "";

  if (view === "3d") {
    map3d.resize();
    update3dPins(lastResults);
    if (lastResults.length > 0) {
      const first = lastResults.find((r) => r.lat && r.lng);
      if (first) flyTo3d(first.lng, first.lat);
    }
  }

  if (view === "lane") {
    map3d.resize();
    if (laneSteps.length) {
      showLaneStep(laneStepIdx);
    }
  } else {
    document.getElementById("lane-hud").classList.add("hidden");
  }
}

function flyTo3d(lng, lat) {
  map3d.flyTo({ center: [lng, lat], zoom: 16, pitch: 55, bearing: -20, speed: 1.2 });
}

// ─── 3D 핀 업데이트 (Point → 미니 사각형 polygon) ────────────────
function update3dPins(data) {
  const src = map3d.getSource("search-results");
  if (!src) return;

  const HALF = 0.00005;
  const features = data
    .filter((item) => item.lat && item.lng)
    .map((item) => ({
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [[
          [item.lng - HALF, item.lat - HALF],
          [item.lng + HALF, item.lat - HALF],
          [item.lng + HALF, item.lat + HALF],
          [item.lng - HALF, item.lat + HALF],
          [item.lng - HALF, item.lat - HALF],
        ]],
      },
      properties: { name: item.name, address: item.address },
    }));

  src.setData({ type: "FeatureCollection", features });
}

// ─── 건물 정보 패널 ──────────────────────────────────────────────
function showBuildingInfo({ height, levels, type, name, lngLat }) {
  const panel = document.getElementById("building-info");
  document.getElementById("building-info-content").innerHTML = `
    <div class="bi-title">${name || "건물"}</div>
    <div class="bi-row"><span>높이</span><strong>${height !== "정보 없음" ? height + " m" : "정보 없음"}</strong></div>
    <div class="bi-row"><span>층수</span><strong>${levels !== "-" ? levels + " F" : "-"}</strong></div>
    <div class="bi-row"><span>유형</span><strong>${type}</strong></div>
    <div class="bi-row"><span>좌표</span><strong>${lngLat.lat.toFixed(5)}, ${lngLat.lng.toFixed(5)}</strong></div>
  `;
  panel.classList.remove("hidden");
}

function closeBuildingInfo() {
  document.getElementById("building-info").classList.add("hidden");
}

// ─── 레이어 전환 ─────────────────────────────────────────────────
function switchLayer(layer) {
  currentLayer = layer;
  document.getElementById("btn-facilities").classList.toggle("active", layer === "facilities");
  document.getElementById("btn-restrooms").classList.toggle("active", layer === "restrooms");
  document.getElementById("filter-facilities").style.display = layer === "facilities" ? "" : "none";
  document.getElementById("filter-restrooms").style.display = layer === "restrooms" ? "" : "none";
  document.getElementById("keyword").value = "";
  search();
}

// ─── 카드 생성 ───────────────────────────────────────────────────
function esc(value) {
  const el = document.createElement("span");
  el.textContent = value ?? "";
  return el.innerHTML;
}

function makeCard(item) {
  const card = document.createElement("div");
  card.className = "card";

  const name = document.createElement("div");
  name.className = "name";
  name.textContent = item.name;

  const meta = document.createElement("div");
  meta.className = "type";
  meta.textContent = currentLayer === "facilities"
    ? `${item.type} · ${item.is_paid === "Y" ? "유료" : "무료"}`
    : item.gu;

  const addr = document.createElement("div");
  addr.className = "addr";
  addr.textContent = item.address;

  card.append(name, meta, addr);
  return card;
}

function makePopup(item) {
  if (currentLayer === "facilities") {
    return `
      <b>${esc(item.name)}</b><br>
      유형: ${esc(item.type)}<br>
      운영: ${esc(item.open_time)} ~ ${esc(item.close_time)}<br>
      유/무료: ${item.is_paid === "Y" ? `유료 (${esc(item.fee)}원)` : "무료"}<br>
      수용: ${esc(item.capacity) || "-"}명<br>
      주소: ${esc(item.address)}<br>
      전화: ${esc(item.phone)}
    `;
  } else {
    return `
      <b>${esc(item.name)}</b><br>
      군구: ${esc(item.gu)}<br>
      주소: ${esc(item.address)}<br>
      지정: ${esc(item.year) || "-"}년
    `;
  }
}

// ─── 검색 ────────────────────────────────────────────────────────
async function search() {
  const keyword = document.getElementById("keyword").value;
  let url;

  if (currentLayer === "facilities") {
    const type = document.getElementById("type").value;
    const is_paid = document.getElementById("is_paid").value;
    url = `/api/facilities?keyword=${encodeURIComponent(keyword)}&type=${encodeURIComponent(type)}&is_paid=${encodeURIComponent(is_paid)}`;
  } else {
    const gu = document.getElementById("gu").value;
    url = `/api/restrooms?keyword=${encodeURIComponent(keyword)}&gu=${encodeURIComponent(gu)}`;
  }

  const res = await fetch(url);
  const data = await res.json();
  lastResults = data;

  markers.forEach((m) => map.removeLayer(m));
  markers = [];

  const list = document.getElementById("list");
  list.innerHTML = "";
  document.getElementById("count").textContent = `검색 결과 ${data.length}건`;

  data.forEach((item) => {
    if (!item.lat || !item.lng) return;

    const marker = L.marker([item.lat, item.lng]).addTo(map);
    marker.bindPopup(makePopup(item));
    markers.push(marker);

    const card = makeCard(item);
    card.onclick = () => {
      if (currentView === "2d") {
        map.setView([item.lat, item.lng], 17);
        marker.openPopup();
      } else {
        flyTo3d(item.lng, item.lat);
      }
    };
    list.appendChild(card);
  });

  if (currentView === "3d") {
    update3dPins(data);
  }
}

search();

// ─── 차선 안내 ────────────────────────────────────────────────────
let laneSteps = [];
let laneStepIdx = 0;
let simTimer = null;
let laneStepMarker = null;

// 거리 SI 표기 (100 m / 1.2 km)
function formatDist(m) {
  if (m < 1000) return `${m} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

// 화살표 SVG (indication → SVG 문자열)
function arrowSvg(indication, color) {
  const c = color || "#94a3b8";
  const arrows = {
    "straight":      `<path d="M16 28 L16 6" stroke="${c}" stroke-width="3" stroke-linecap="round"/>
                      <polyline points="10,12 16,6 22,12" fill="none" stroke="${c}" stroke-width="3" stroke-linejoin="round"/>`,
    "left":          `<path d="M22 26 L22 18 Q22 10 14 10 L10 10" stroke="${c}" stroke-width="3" stroke-linecap="round" fill="none"/>
                      <polyline points="14,6 10,10 14,14" fill="none" stroke="${c}" stroke-width="3" stroke-linejoin="round"/>`,
    "slight left":   `<path d="M22 26 L22 18 Q22 10 14 10 L10 10" stroke="${c}" stroke-width="2.5" stroke-linecap="round" fill="none" stroke-dasharray="2,0" opacity="0.7"/>
                      <polyline points="14,6 10,10 14,14" fill="none" stroke="${c}" stroke-width="2.5" stroke-linejoin="round" opacity="0.7"/>`,
    "right":         `<path d="M10 26 L10 18 Q10 10 18 10 L22 10" stroke="${c}" stroke-width="3" stroke-linecap="round" fill="none"/>
                      <polyline points="18,6 22,10 18,14" fill="none" stroke="${c}" stroke-width="3" stroke-linejoin="round"/>`,
    "slight right":  `<path d="M10 26 L10 18 Q10 10 18 10 L22 10" stroke="${c}" stroke-width="2.5" stroke-linecap="round" fill="none" opacity="0.7"/>
                      <polyline points="18,6 22,10 18,14" fill="none" stroke="${c}" stroke-width="2.5" stroke-linejoin="round" opacity="0.7"/>`,
    "uturn":         `<path d="M10 26 L10 14 Q10 6 18 6 Q26 6 26 14 Q26 22 18 22 L14 22" stroke="${c}" stroke-width="3" stroke-linecap="round" fill="none"/>
                      <polyline points="18,26 14,22 18,18" fill="none" stroke="${c}" stroke-width="3" stroke-linejoin="round"/>`,
    "sharp left":    `<path d="M22 26 L22 18 Q22 10 14 10 L10 10" stroke="${c}" stroke-width="3" stroke-linecap="round" fill="none"/>
                      <polyline points="14,6 10,10 14,14" fill="none" stroke="${c}" stroke-width="3" stroke-linejoin="round"/>`,
    "sharp right":   `<path d="M10 26 L10 18 Q10 10 18 10 L22 10" stroke="${c}" stroke-width="3" stroke-linecap="round" fill="none"/>
                      <polyline points="18,6 22,10 18,14" fill="none" stroke="${c}" stroke-width="3" stroke-linejoin="round"/>`,
  };
  const path = arrows[indication] || arrows["straight"];
  return `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">${path}</svg>`;
}

function calcRecommendedLane(modifier, laneCount) {
  switch (modifier) {
    case "left":
    case "sharp left":
    case "uturn":       return 0;
    case "slight left": return Math.max(0, Math.floor(laneCount * 0.25));
    case "right":
    case "sharp right": return laneCount - 1;
    case "slight right":return Math.min(laneCount - 1, Math.ceil(laneCount * 0.75));
    default:            return Math.floor((laneCount - 1) / 2);
  }
}

function buildIndications(modifier, laneCount) {
  const arr = Array(laneCount).fill("straight");
  if (modifier === "left" || modifier === "sharp left" || modifier === "uturn") {
    arr[0] = modifier === "uturn" ? "uturn" : "left";
  } else if (modifier === "slight left") {
    arr[0] = "slight left";
    if (laneCount > 1) arr[1] = "slight left";
  } else if (modifier === "right" || modifier === "sharp right") {
    arr[laneCount - 1] = "right";
  } else if (modifier === "slight right") {
    arr[laneCount - 1] = "slight right";
    if (laneCount > 1) arr[laneCount - 2] = "slight right";
  }
  return arr;
}

function modifierToKo(modifier) {
  const map = {
    "left": "좌회전", "sharp left": "급좌회전", "slight left": "좌측 유지",
    "right": "우회전", "sharp right": "급우회전", "slight right": "우측 유지",
    "straight": "직진", "uturn": "유턴",
  };
  return map[modifier] || "직진";
}

function renderLaneHud(model) {
  const { laneCount, recommendedIndex, indications, distanceM, maneuverText } = model;
  const hud = document.getElementById("lane-hud");
  document.getElementById("lane-hud-dist").textContent =
    distanceM != null ? `${formatDist(distanceM)} 앞  ${maneuverText || ""}` : (maneuverText || "");

  const lanesEl = document.getElementById("lane-hud-lanes");
  lanesEl.innerHTML = "";
  for (let i = 0; i < laneCount; i++) {
    const isRec = i === recommendedIndex;
    const ind = (indications && indications[i]) || "straight";
    const color = isRec ? "#22c55e" : "#64748b";

    const card = document.createElement("div");
    card.className = "lane-card" + (isRec ? " recommended" : "");

    if (isRec) {
      const car = document.createElement("div");
      car.className = "lane-car";
      car.textContent = "🚗";
      card.appendChild(car);
    }

    const arrowEl = document.createElement("div");
    arrowEl.className = "lane-arrow";
    arrowEl.innerHTML = arrowSvg(ind, color);
    card.appendChild(arrowEl);

    const numEl = document.createElement("div");
    numEl.className = "lane-num";
    numEl.textContent = `${i + 1}차로`;
    card.appendChild(numEl);

    lanesEl.appendChild(card);
  }

  hud.classList.remove("hidden");
}

async function startLaneGuide() {
  const origin = document.getElementById("lane-origin").value.trim();
  const dest = document.getElementById("lane-dest").value.trim();
  if (!origin || !dest) return alert("출발지와 목적지를 입력하세요.");

  document.getElementById("lane-step-info").textContent = "경로 탐색 중...";

  const [oCoord, dCoord] = await Promise.all([
    geocodeKakao(origin, "origin"),
    geocodeKakao(dest, "dest"),
  ]);

  if (!oCoord || !dCoord) {
    document.getElementById("lane-step-info").textContent = "주소를 찾을 수 없습니다.";
    return;
  }

  const url = `https://router.project-osrm.org/route/v1/driving/${oCoord.lng},${oCoord.lat};${dCoord.lng},${dCoord.lat}?steps=true&geometries=geojson&overview=full`;
  const res = await fetch(url);
  const data = await res.json();

  if (data.code !== "Ok") {
    document.getElementById("lane-step-info").textContent = "경로를 찾을 수 없습니다.";
    return;
  }

  const steps = data.routes[0].legs[0].steps;
  const routeCoords = data.routes[0].geometry.coordinates;

  laneSteps = steps
    .filter((s) => s.maneuver.type !== "depart" && s.maneuver.type !== "arrive")
    .map((s) => ({
      modifier: s.maneuver.modifier || "straight",
      distanceM: Math.round(s.distance),
      name: s.name,
      laneCount: 3,
      lat: s.maneuver.location[1],
      lng: s.maneuver.location[0],
    }));

  laneStepIdx = 0;
  showLaneStep(laneStepIdx);
  document.getElementById("lane-sim-controls").style.display = "block";

  // 지도 위에 경로 라인 표시
  updateRouteLayer(routeCoords);
}

// 선택된 좌표 캐시 (자동완성에서 선택 시 저장)
const selectedCoords = { origin: null, dest: null };

let suggestTimer = null;
function onSuggest(input, type) {
  clearTimeout(suggestTimer);
  selectedCoords[type] = null;
  const q = input.value.trim();
  const listEl = document.getElementById(`suggest-${type}`);
  if (q.length < 2) { listEl.innerHTML = ""; return; }

  suggestTimer = setTimeout(async () => {
    const res = await fetch(`/api/suggest?q=${encodeURIComponent(q)}`);
    const items = await res.json();
    listEl.innerHTML = "";
    items.forEach((item) => {
      const div = document.createElement("div");
      div.className = "suggest-item";
      div.innerHTML = `<span class="si-name">${item.name}</span><span class="si-addr">${item.address}</span>`;
      div.onclick = () => {
        input.value = item.name;
        selectedCoords[type] = { lat: item.lat, lng: item.lng };
        listEl.innerHTML = "";
      };
      listEl.appendChild(div);
    });
  }, 250);
}

async function geocodeKakao(address, type) {
  if (selectedCoords[type]) return selectedCoords[type];
  const res = await fetch(`/api/geocode?q=${encodeURIComponent(address)}`);
  if (!res.ok) return null;
  return res.json();
}

function showLaneStep(idx) {
  if (!laneSteps.length) return;
  const step = laneSteps[Math.min(idx, laneSteps.length - 1)];
  const recIdx = calcRecommendedLane(step.modifier, step.laneCount);
  const indications = buildIndications(step.modifier, step.laneCount);

  renderLaneHud({
    laneCount: step.laneCount,
    recommendedIndex: recIdx,
    indications,
    distanceM: step.distanceM,
    maneuverText: modifierToKo(step.modifier),
  });

  const isLast = idx >= laneSteps.length - 1;
  document.getElementById("lane-step-info").innerHTML =
    `<span class="step-num">${idx + 1} / ${laneSteps.length}</span> ` +
    `<span class="step-road">${step.name || ""}</span> ` +
    `<span class="step-action">${modifierToKo(step.modifier)}</span>` +
    (isLast ? " · <b>목적지 도착</b>" : "");

  // 해당 교차로로 카메라 이동
  if (step.lat && step.lng) {
    map3d.flyTo({
      center: [step.lng, step.lat],
      zoom: 17,
      pitch: 55,
      bearing: -20,
      speed: 1.0,
    });

    // 위치 마커 업데이트
    if (!laneStepMarker) {
      laneStepMarker = new maptilersdk.Marker({ color: "#22c55e" })
        .setLngLat([step.lng, step.lat])
        .addTo(map3d);
    } else {
      laneStepMarker.setLngLat([step.lng, step.lat]);
    }
  }
}

function toggleSim() {
  if (simTimer) {
    clearInterval(simTimer);
    simTimer = null;
    document.getElementById("btn-sim").textContent = "▶ 시뮬레이션";
    return;
  }
  laneStepIdx = 0;
  showLaneStep(laneStepIdx);
  document.getElementById("btn-sim").textContent = "⏹ 정지";

  simTimer = setInterval(() => {
    laneStepIdx++;
    if (laneStepIdx >= laneSteps.length) {
      clearInterval(simTimer);
      simTimer = null;
      document.getElementById("btn-sim").textContent = "▶ 시뮬레이션";
      return;
    }
    showLaneStep(laneStepIdx);
  }, 2000);
}

function updateRouteLayer(coords) {
  const geojson = {
    type: "Feature",
    geometry: { type: "LineString", coordinates: coords },
  };

  if (map3d.getSource("route")) {
    map3d.getSource("route").setData(geojson);
    return;
  }

  map3d.addSource("route", { type: "geojson", data: geojson });
  map3d.addLayer({
    id: "route-line",
    type: "line",
    source: "route",
    layout: { "line-join": "round", "line-cap": "round" },
    paint: { "line-color": "#2c7be5", "line-width": 5, "line-opacity": 0.85 },
  });
}
