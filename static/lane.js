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

  // 화살표: XZ 평면. ConeGeometry 기본 끝은 +Y 방향
  // body를 X축 -90도 회전 → 끝이 -Z(화면 위=직진 방향)를 가리킴
  // 이후 그룹 Y축 회전으로 방향 제어
  const bodyLen = 1.2;
  const headLen = 0.55;

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, bodyLen, 8), mat);
  body.rotation.x = -Math.PI / 2;        // +Z(뒤) 방향으로 눕힘
  body.position.z = bodyLen / 2;         // 기둥: 뒤쪽

  const head = new THREE.Mesh(new THREE.ConeGeometry(0.26, headLen, 8), mat);
  head.rotation.x = -Math.PI / 2;        // cone 뾰족한 끝이 -Z 방향
  head.position.z = -(headLen / 2);      // 머리: 앞쪽

  const g = new THREE.Group();
  g.add(body);
  g.add(head);
  g.position.set(x, 0.25, 1);
  g.userData.isLane = true;

  // Y축 회전: 직진=0, 좌회전=+90°(왼쪽), 우회전=-90°(오른쪽)
  const rotations = {
    "straight":      0,
    "left":          Math.PI / 2,
    "slight left":   Math.PI / 4,
    "right":        -Math.PI / 2,
    "slight right": -Math.PI / 4,
    "uturn":         Math.PI,
    "sharp left":    Math.PI / 2,
    "sharp right":  -Math.PI / 2,
  };
  g.rotation.y = rotations[indication] ?? 0;

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
