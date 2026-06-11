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
      "fill-extrusion-height": 40,
      "fill-extrusion-base": 0,
      "fill-extrusion-opacity": 0.9,
    },
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
  document.getElementById("map").style.display = view === "2d" ? "block" : "none";
  document.getElementById("map3d").style.display = view === "3d" ? "block" : "none";

  if (view === "3d") {
    map3d.resize();
    update3dPins(lastResults);
    if (lastResults.length > 0) {
      const first = lastResults.find((r) => r.lat && r.lng);
      if (first) flyTo3d(first.lng, first.lat);
    }
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
