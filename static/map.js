const map = L.map("map").setView([37.55, 126.72], 11);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap",
}).addTo(map);

let markers = [];
let currentLayer = "facilities";

function esc(value) {
  const el = document.createElement("span");
  el.textContent = value ?? "";
  return el.innerHTML;
}

function switchLayer(layer) {
  currentLayer = layer;

  document.getElementById("btn-facilities").classList.toggle("active", layer === "facilities");
  document.getElementById("btn-restrooms").classList.toggle("active", layer === "restrooms");
  document.getElementById("filter-facilities").style.display = layer === "facilities" ? "" : "none";
  document.getElementById("filter-restrooms").style.display = layer === "restrooms" ? "" : "none";

  document.getElementById("keyword").value = "";
  search();
}

function makeCard(item) {
  const card = document.createElement("div");
  card.className = "card";

  const name = document.createElement("div");
  name.className = "name";
  name.textContent = item.name;

  const meta = document.createElement("div");
  meta.className = "type";

  const addr = document.createElement("div");
  addr.className = "addr";
  addr.textContent = item.address;

  if (currentLayer === "facilities") {
    meta.textContent = `${item.type} · ${item.is_paid === "Y" ? "유료" : "무료"}`;
  } else {
    meta.textContent = item.gu;
  }

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
      map.setView([item.lat, item.lng], 17);
      marker.openPopup();
    };
    list.appendChild(card);
  });
}

search();
