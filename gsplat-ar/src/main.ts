/// <reference types="webxr" />

import * as THREE from "three";
import { ARButton } from "three/examples/jsm/webxr/ARButton.js";
import * as GS from "@mkkellogg/gaussian-splats-3d";

/* -----------------------------------------------------------
 * 0) 모델 선택 UI (쿼리로 선택 유지)
 * ---------------------------------------------------------*/
const MODEL_LIST = ["Korea.splat", "Korea2.splat", "Japan.splat", "London.splat"];
const MODEL_Y_OFFSET: Record<string, number> = {
  "Korea2.splat": 1,   // 0.6 m 위로
  // 다른 모델은 기본 0 (키 없으면 0으로 처리)
};
const params = new URLSearchParams(location.search);
const selectedModel = params.get("model") && MODEL_LIST.includes(params.get("model")!)
  ? params.get("model")!
  : MODEL_LIST[0];

// 간단한 오버레이 UI 생성
{
  const bar = document.createElement("div");
  bar.style.cssText = `
    position:fixed; left:10px; top:10px; z-index:10000;
    display:flex; gap:8px; padding:8px 10px;
    background:rgba(0,0,0,0.5); color:#fff; border-radius:10px;
    font-family:system-ui, sans-serif; backdrop-filter: blur(4px);
  `;
  const sel = document.createElement("select");
  sel.id = "modelSelect";
  sel.style.cssText = "padding:4px; border-radius:6px;";
  for (const name of MODEL_LIST) {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    if (name === selectedModel) opt.selected = true;
    sel.appendChild(opt);
  }
  const btn = document.createElement("button");
  btn.id = "modelLoadBtn";
  btn.textContent = "Load";
  btn.style.cssText = "padding:4px 10px; border-radius:6px;";

  // 로드 버튼 → 세션 종료 후 쿼리 변경하여 새로고침(안정적)
  btn.addEventListener("click", async () => {
    const chosen = (document.getElementById("modelSelect") as HTMLSelectElement).value;
    const sess = renderer.xr.getSession?.();
    if (sess) await sess.end();
    const p = new URLSearchParams(location.search);
    p.set("model", chosen);
    location.search = p.toString();
  });

  bar.appendChild(sel);
  bar.appendChild(btn);
  document.body.appendChild(bar);
}

/* -----------------------------------------------------------
 * 1) 렌더러 + XR
 * ---------------------------------------------------------*/
const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
document.body.style.margin = "0";
document.body.appendChild(renderer.domElement);

/* -----------------------------------------------------------
 * 2) 씬/카메라
 * ---------------------------------------------------------*/
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera();

/* -----------------------------------------------------------
 * 3) GS3D DropInViewer (three 씬에 드롭인)
 *    - selfDrivenMode=false → 우리 루프에서 tick/update 호출
 * ---------------------------------------------------------*/
const viewer = new GS.DropInViewer({
  selfDrivenMode: false,
  useBuiltInControls: false,
  webXRMode: GS.WebXRMode.AR,
  renderer,
  camera,
});
scene.add(viewer);

/* -----------------------------------------------------------
 * 4) 모델 로딩 (.splat → 실패 시 .ply 폴백)
 *    ⚠ URL 끝에 확장자 그대로(쿼리 붙이지 않기)
 * ---------------------------------------------------------*/
async function loadSplatWithDebug(filename: string) {
  console.time("splatLoad");
  try {
    const splatUrl = `/models/${filename}`;
    console.log("[SPLAT] GET", splatUrl);
    await viewer.addSplatScene(splatUrl);
    console.timeEnd("splatLoad");
    console.log("[SPLAT] loaded");
    return;
  } catch (e) {
    console.warn("[SPLAT] failed → fallback to .ply", e);
  }
  // 같은 이름의 .ply가 있을 때만 폴백 원하면 아래 주석 해제
  // try {
  //   const plyUrl = `/models/${filename.replace(/\.splat$/i, ".ply")}`;
  //   console.log("[PLY] GET", plyUrl);
  //   await viewer.addSplatScene(plyUrl);
  //   console.timeEnd("splatLoad");
  //   console.log("[PLY] loaded");
  // } catch (e) {
  //   console.error("[PLY] failed:", e);
  //   console.timeEnd("splatLoad");
  //   throw e;
  // }
}
await loadSplatWithDebug(selectedModel);
viewer.visible = false; // 배치 전까지 숨김

/* -----------------------------------------------------------
 * 5) 히트테스트용 레티클
 * ---------------------------------------------------------*/
const reticle = new THREE.Mesh(
  new THREE.RingGeometry(0.12, 0.15, 32).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: 0x00ff88 })
);
reticle.matrixAutoUpdate = false;
reticle.visible = false;
scene.add(reticle);

/* -----------------------------------------------------------
 * 6) AR 버튼
 * ---------------------------------------------------------*/
document.body.appendChild(
  ARButton.createButton(renderer, {
    requiredFeatures: ["hit-test"],
    optionalFeatures: ["dom-overlay"],
    domOverlay: { root: document.body },
  })
);

/* -----------------------------------------------------------
 * 7) XR 세션에서 히트테스트 소스 생성(옵셔널 가드)
 * ---------------------------------------------------------*/
let hitTestSource: XRHitTestSource | null = null;
let localSpace: XRReferenceSpace | null = null;

renderer.xr.addEventListener("sessionstart", async () => {
  const session = renderer.xr.getSession()!;
  const viewerSpace = await session.requestReferenceSpace("viewer");

  try {
    localSpace = await session.requestReferenceSpace("local-floor");
  } catch {
    localSpace = await session.requestReferenceSpace("local");
  }

  const s = session as XRSession & {
    requestHitTestSource?: (opts: { space: XRSpace }) => Promise<XRHitTestSource>;
  };
  const src = await s.requestHitTestSource?.({ space: viewerSpace });
  if (src) {
    hitTestSource = src;
  } else {
    console.warn("WebXR Hit-Test API not available on this session.");
    hitTestSource = null;
  }

  session.addEventListener("end", () => {
    hitTestSource = null;
    localSpace = null;
    reticle.visible = false;
  });
});

/* -----------------------------------------------------------
 * 8) 탭(컨트롤러 select)으로 스플랫 배치
 *    - 위아래 뒤집힘 보정: rotateX(Math.PI)
 * ---------------------------------------------------------*/
const controller = renderer.xr.getController(0);
scene.add(controller);

controller.addEventListener("select", () => {
  if (!reticle.visible) return;
  viewer.visible = true;

  // 레티클의 월드 변환 적용
  reticle.matrix.decompose(viewer.position, viewer.quaternion, viewer.scale);

  // 상하 뒤집힘 보정
  viewer.rotateX(Math.PI);

  // ✅ 선택된 모델에 따라 높이 보정
  const dy = MODEL_Y_OFFSET[selectedModel] ?? 0;  // selectedModel은 드롭다운에서 선택된 파일명
  if (dy !== 0) viewer.position.y += dy;
});


/* -----------------------------------------------------------
 * 9) 렌더 루프 (Hit-Test + GS3D 업데이트)
 * ---------------------------------------------------------*/
let last = 0;
renderer.setAnimationLoop((t: number, frame?: XRFrame) => {
  const dt = (t - last) / 1000;
  last = t;

  if (frame && hitTestSource && localSpace) {
    const results = frame.getHitTestResults(hitTestSource);
    if (results.length) {
      const pose = results[0].getPose(localSpace);
      if (pose) {
        reticle.visible = true;
        reticle.matrix.fromArray(pose.transform.matrix as unknown as number[]);
      }
    } else {
      reticle.visible = false;
    }
  }

  const v: any = viewer;
  if (typeof v.tick === "function") v.tick(dt, frame);
  else if (typeof v.update === "function") v.update(dt, frame);

  renderer.render(scene, camera);
});

window.addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
});
