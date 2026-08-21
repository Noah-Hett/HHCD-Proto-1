import * as THREE from "three";
import { categoryStyle } from "./grouping.js";

export const FOLDER_W = 0.5;
export const FOLDER_D = 1.38;
export const FOLDER_BACK_H = 2.52;
export const FOLDER_FRONT_H = 1.62;

export const REPORT_H = 2.08;
export const REPORT_D = 1.12;
export const REPORT_THICK = 0.02;

const C_LEFT = "#7A5D44";
const C_FRONT = "#5C4230";
const C_TOP = "#8C6E50";
const C_DARK = "#4A3222";
const C_LABEL = "#F4EEE4";
const C_HOLE = "#2A160C";
const C_SHADOW = "#6E868C";
const C_PAGES = "#EFE8DC";
const C_RINGS = "#1A120C";

function quad(p0, p1, p2, p3, color) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute(
    "position",
    new THREE.BufferAttribute(
      new Float32Array([...p0, ...p1, ...p2, ...p0, ...p2, ...p3]),
      3,
    ),
  );
  geo.computeVertexNormals();
  return new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }),
  );
}

export function createSharedResources() {
  const pagesGeo = new THREE.BoxGeometry(
    REPORT_THICK,
    REPORT_H * 0.98,
    REPORT_D * 0.96,
  );
  const coverGeo = new THREE.BoxGeometry(0.006, REPORT_H, REPORT_D);
  const backGeo = new THREE.BoxGeometry(0.006, REPORT_H, REPORT_D);
  const ringGeo = new THREE.TorusGeometry(0.028, 0.009, 5, 10);
  const pagesMat = new THREE.MeshBasicMaterial({ color: C_PAGES });
  const backMat = new THREE.MeshBasicMaterial({ color: "#D9D0C2" });
  const ringMat = new THREE.MeshBasicMaterial({ color: C_RINGS });
  return { pagesGeo, coverGeo, backGeo, ringGeo, pagesMat, backMat, ringMat };
}

export function disposeSharedResources(shared) {
  shared.pagesGeo.dispose();
  shared.coverGeo.dispose();
  shared.backGeo.dispose();
  shared.ringGeo.dispose();
  shared.pagesMat.dispose();
  shared.backMat.dispose();
  shared.ringMat.dispose();
}

export function createFolderMesh(folderId) {
  const group = new THREE.Group();
  const pickable = [];

  const bw = FOLDER_W;
  const bd = FOLDER_D;
  const backH = FOLDER_BACK_H;
  const frontH = FOLDER_FRONT_H;

  const blb = [0, 0, 0];
  const brb = [bw, 0, 0];
  const flb = [0, 0, bd];
  const frb = [bw, 0, bd];
  const blt = [0, backH, 0];
  const brt = [bw, backH, 0];
  const flt = [0, frontH, bd];
  const frt = [bw, frontH, bd];

  const addFace = (a, b, c, d, color) => {
    const mesh = quad(a, b, c, d, color);
    mesh.userData.kind = "folder";
    mesh.userData.folderId = folderId;
    group.add(mesh);
    pickable.push(mesh);
  };

  addFace(flb, blb, blt, flt, C_LEFT);
  addFace(brb, frb, frt, brt, C_DARK);
  addFace(flb, frb, frt, flt, C_FRONT);
  addFace(brb, blb, blt, brt, C_DARK);
  addFace(blb, brb, frb, flb, C_DARK);
  addFace(flt, frt, brt, blt, C_TOP);

  const hole = new THREE.Mesh(
    new THREE.CircleGeometry(0.09, 18),
    new THREE.MeshBasicMaterial({ color: C_HOLE, side: THREE.DoubleSide }),
  );
  hole.scale.set(1, 0.5, 1);
  hole.position.set(bw / 2, 0.4, bd + 0.004);
  hole.userData.kind = "folder";
  hole.userData.folderId = folderId;
  group.add(hole);
  pickable.push(hole);

  const plate = new THREE.Mesh(
    new THREE.PlaneGeometry(0.28, 0.16),
    new THREE.MeshBasicMaterial({ color: C_LABEL, side: THREE.DoubleSide }),
  );
  plate.position.set(bw / 2, 0.18, bd + 0.005);
  plate.userData.kind = "folder";
  plate.userData.folderId = folderId;
  group.add(plate);
  pickable.push(plate);

  const shadow = quad(
    [0.28, -0.02, -0.28],
    [bw + 0.62, -0.02, -0.28],
    [bw + 0.82, -0.02, bd + 0.12],
    [0.08, -0.02, bd + 0.12],
    C_SHADOW,
  );
  shadow.material.transparent = true;
  shadow.material.opacity = 0.28;
  shadow.userData.kind = "shadow";
  group.add(shadow);

  group.userData.kind = "folder";
  group.userData.folderId = folderId;
  return { group, pickable };
}

export function createCoverTexture(report) {
  const style = categoryStyle(report.category);
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 192;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = style.color;
  ctx.fillRect(0, 0, 128, 192);

  ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
  ctx.fillRect(0, 0, 128, 36);

  ctx.fillStyle = "rgba(255, 255, 255, 0.14)";
  ctx.font = "bold 92px Georgia, serif";
  ctx.textAlign = "center";
  ctx.fillText(style.initial, 64, 118);

  ctx.fillStyle = "#FFFFFF";
  ctx.textAlign = "left";
  ctx.font = "bold 18px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText(`No. ${report.reportNo}`, 10, 24);

  ctx.font = "14px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText(String(report.year ?? ""), 10, 178);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export function createReportMesh(report, shared) {
  const group = new THREE.Group();
  const pickable = [];
  const style = categoryStyle(report.category);
  const texture = createCoverTexture(report);

  const pages = new THREE.Mesh(shared.pagesGeo, shared.pagesMat);
  pages.position.x = 0.004;
  group.add(pages);
  pickable.push(pages);

  const back = new THREE.Mesh(shared.backGeo, shared.backMat);
  back.position.x = 0.016;
  group.add(back);
  pickable.push(back);

  const coverMat = new THREE.MeshBasicMaterial({ map: texture });
  const cover = new THREE.Mesh(shared.coverGeo, coverMat);
  cover.position.x = -0.01;
  group.add(cover);
  pickable.push(cover);

  const spine = new THREE.Mesh(
    new THREE.BoxGeometry(0.018, REPORT_H * 0.98, 0.018),
    new THREE.MeshBasicMaterial({ color: style.color }),
  );
  spine.position.set(0.002, 0, REPORT_D / 2 - 0.01);
  group.add(spine);
  pickable.push(spine);

  for (let i = 0; i < 8; i += 1) {
    const ring = new THREE.Mesh(shared.ringGeo, shared.ringMat);
    ring.position.set(
      -0.002,
      -REPORT_H / 2 + 0.22 + i * 0.235,
      REPORT_D / 2 - 0.01,
    );
    ring.rotation.y = Math.PI / 2;
    group.add(ring);
    pickable.push(ring);
  }

  group.traverse((obj) => {
    if (obj.isMesh) {
      obj.userData.kind = "report";
      obj.userData.reportNo = report.reportNo;
    }
  });

  group.userData.kind = "report";
  group.userData.reportNo = report.reportNo;
  group.userData.texture = texture;
  group.userData.coverMat = coverMat;

  return { group, pickable, texture, coverMat };
}

export function folderSpacing(count) {
  if (count <= 4) return 1.38;
  if (count <= 5) return 1.14;
  if (count <= 6) return 0.98;
  return 0.84;
}

export function computeLayout(folders) {
  const n = folders.length;
  const spacing = folderSpacing(n);
  const folderPos = {};
  const reportPos = {};

  folders.forEach((folder, index) => {
    const x = -((n - 1) * spacing) / 2 + index * spacing;
    folderPos[folder.id] = { x, y: 0, z: 0, folder };
    const count = folder.reports.length;
    const inner = FOLDER_W - 0.08;
    const slot = Math.min(0.03, inner / Math.max(count, 1));
    folder.reports.forEach((report, slotIndex) => {
      const xOff = (slotIndex - (count - 1) / 2) * slot;
      reportPos[report.reportNo] = {
        x: x + FOLDER_W * 0.5 + xOff,
        y: REPORT_H * 0.5 + 0.03,
        z: FOLDER_D * 0.46,
        rx: 0.1,
        folderId: folder.id,
        slotIndex,
        count,
      };
    });
  });

  return { folderPos, reportPos, folders, spacing, count: n };
}
