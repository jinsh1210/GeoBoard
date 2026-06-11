// ─── Three.js 차선 3D 렌더러 ──────────────────────────────────────

let laneScene = null;
let laneCamera = null;
let laneRenderer = null;

function initLaneRenderer(container) {
  const w = container.offsetWidth || 800;
  const h = container.offsetHeight || 500;

  if (laneRenderer) {
    laneCamera.aspect = w / h;
    laneCamera.updateProjectionMatrix();
    laneRenderer.setSize(w, h, false);
    return;
  }

  laneScene = new THREE.Scene();
  laneScene.background = new THREE.Color(0x0f172a);

  laneCamera = new THREE.PerspectiveCamera(50, w / h, 0.1, 200);
  laneCamera.position.set(0, 8, 14);
  laneCamera.lookAt(0, 0, 0);

  laneRenderer = new THREE.WebGLRenderer({ antialias: true });
  laneRenderer.setSize(w, h, false);
  container.appendChild(laneRenderer.domElement);

  laneScene.add(new THREE.AmbientLight(0xffffff, 0.5));
  const dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.set(5, 10, 5);
  laneScene.add(dir);

  (function animate() {
    requestAnimationFrame(animate);
    laneRenderer.render(laneScene, laneCamera);
  })();
}

// model: { laneCount, recommendedIndex, indications, distanceM, maneuverText }
function renderLaneView(model) {
  if (!laneScene) return;

  // 이전 lane 오브젝트 제거
  for (let i = laneScene.children.length - 1; i >= 0; i--) {
    if (laneScene.children[i].userData.isLane) {
      laneScene.remove(laneScene.children[i]);
    }
  }

  const { laneCount, recommendedIndex, indications, distanceM, maneuverText } = model;
  const LW = 2.8;   // 차선 폭
  const LD = 12;    // 도로 깊이
  const totalW = laneCount * LW;

  // 도로 바닥
  addLaneMesh(new THREE.BoxGeometry(totalW + 0.4, 0.1, LD + 2),
    new THREE.MeshLambertMaterial({ color: 0x1e293b }),
    0, 0, 0);

  for (let i = 0; i < laneCount; i++) {
    const x = (i - (laneCount - 1) / 2) * LW;
    const isRec = i === recommendedIndex;

    // 차선 구분선
    if (i < laneCount - 1) {
      addLaneMesh(new THREE.BoxGeometry(0.07, 0.12, LD),
        new THREE.MeshLambertMaterial({ color: 0x475569 }),
        x + LW / 2, 0.06, 0);
    }

    // 권장 차선 하이라이트
    if (isRec) {
      addLaneMesh(new THREE.BoxGeometry(LW - 0.2, 0.12, LD),
        new THREE.MeshLambertMaterial({ color: 0x22c55e, transparent: true, opacity: 0.3 }),
        x, 0.06, 0);
    }

    // 화살표
    const ind = (indications && indications[i]) || "straight";
    addArrow(x, ind, isRec);
  }

  // 안내 텍스트 스프라이트
  if (distanceM != null) {
    addTextSprite(`${distanceM}m 앞  ${maneuverText || ""}`, 0, 4.5, -3);
  }
}

function addLaneMesh(geo, mat, x, y, z) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.userData.isLane = true;
  laneScene.add(m);
}

function addArrow(x, indication, isRec) {
  const color = isRec ? 0x4ade80 : 0x64748b;
  const mat = new THREE.MeshLambertMaterial({ color });

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.2, 8), mat);
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.5, 8), mat);
  head.position.y = 0.85;

  const g = new THREE.Group();
  g.add(body);
  g.add(head);
  g.position.set(x, 1.2, -1);
  g.userData.isLane = true;

  if (indication === "left")        g.rotation.z = -Math.PI / 2;
  else if (indication === "slight left")  g.rotation.z = -Math.PI / 4;
  else if (indication === "right")        g.rotation.z =  Math.PI / 2;
  else if (indication === "slight right") g.rotation.z =  Math.PI / 4;
  else if (indication === "uturn")        g.rotation.z =  Math.PI;
  // straight: 기본값 (위 방향)

  laneScene.add(g);
}

function addTextSprite(text, x, y, z) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 80;
  const ctx = canvas.getContext("2d");
  ctx.font = "bold 34px sans-serif";
  ctx.fillStyle = "#f1f5f9";
  ctx.textAlign = "center";
  ctx.fillText(text, 256, 52);
  const tex = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  sprite.scale.set(7, 1.1, 1);
  sprite.position.set(x, y, z);
  sprite.userData.isLane = true;
  laneScene.add(sprite);
}

// ─── 권장 차선 계산 ───────────────────────────────────────────────
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
