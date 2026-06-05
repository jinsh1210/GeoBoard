const map = L.map("map").setView([37.55, 126.72], 11);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap",
}).addTo(map);

let markers = [];
let currentLayer = "facilities";

function switchLayer(layer) {
  currentLayer = layer;

  document.getElementById("btn-facilities").classList.toggle("active", layer === "facilities");
  document.getElementById("btn-restrooms").classList.toggle("active", layer === "restrooms");
  document.getElementById("filter-facilities").style.display = layer === "facilities" ? "" : "none";
  document.getElementById("filter-restrooms").style.display = layer === "restrooms" ? "" : "none";

  document.getElementById("keyword").value = "";
  search();
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

    if (currentLayer === "facilities") {
      marker.bindPopup(`
        <b>${item.name}</b><br>
        유형: ${item.type}<br>
        운영: ${item.open_time} ~ ${item.close_time}<br>
        유/무료: ${item.is_paid === "Y" ? "유료 (" + item.fee + "원)" : "무료"}<br>
        수용: ${item.capacity || "-"}명<br>
        주소: ${item.address}<br>
        전화: ${item.phone}
      `);
    } else {
      marker.bindPopup(`
        <b>${item.name}</b><br>
        군구: ${item.gu}<br>
        주소: ${item.address}<br>
        지정: ${item.year || "-"}년
      `);
    }
    markers.push(marker);

    const card = document.createElement("div");
    card.className = "card";
    if (currentLayer === "facilities") {
      card.innerHTML = `
        <div class="name">${item.name}</div>
        <div class="type">${item.type} · ${item.is_paid === "Y" ? "유료" : "무료"}</div>
        <div class="addr">${item.address}</div>
      `;
    } else {
      card.innerHTML = `
        <div class="name">${item.name}</div>
        <div class="type">${item.gu}</div>
        <div class="addr">${item.address}</div>
      `;
    }
    card.onclick = () => {
      map.setView([item.lat, item.lng], 17);
      marker.openPopup();
    };
    list.appendChild(card);
  });
}

search();
