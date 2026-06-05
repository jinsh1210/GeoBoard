const map = L.map("map").setView([37.453, 126.672], 14);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap",
}).addTo(map);

let markers = [];

async function search() {
  const keyword = document.getElementById("keyword").value;
  const type = document.getElementById("type").value;
  const is_paid = document.getElementById("is_paid").value;

  const res = await fetch(
    `/api/facilities?keyword=${keyword}&type=${type}&is_paid=${is_paid}`,
  );
  const data = await res.json();

  // 기존 마커 제거
  markers.forEach((m) => map.removeLayer(m));
  markers = [];

  const list = document.getElementById("list");
  list.innerHTML = "";
  document.getElementById("count").textContent = `검색 결과 ${data.length}건`;

  data.forEach((item) => {
    // 마커
    const marker = L.marker([item.lat, item.lng]).addTo(map);
    marker.bindPopup(`
            <b>${item.name}</b><br>
            유형: ${item.type}<br>
            운영: ${item.open_time} ~ ${item.close_time}<br>
            유/무료: ${item.is_paid === "Y" ? "유료 (" + item.fee + "원)" : "무료"}<br>
            수용: ${item.capacity || "-"}명<br>
            주소: ${item.address}<br>
            전화: ${item.phone}
        `);
    markers.push(marker);

    // 사이드바 카드
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
            <div class="name">${item.name}</div>
            <div class="type">${item.type} · ${item.is_paid === "Y" ? "유료" : "무료"}</div>
            <div class="addr">${item.address}</div>
        `;
    card.onclick = () => {
      map.setView([item.lat, item.lng], 17);
      marker.openPopup();
    };
    list.appendChild(card);
  });
}

// 초기 로딩
search();
