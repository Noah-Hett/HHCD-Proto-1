import * as THREE from "three";
import { coverColorFor } from "./grouping.js";

export const FOLDER_W = 0.62;
export const FOLDER_D = 1.48;
export const FOLDER_BACK_H = 2.58;
export const FOLDER_FRONT_H = 1.32;
export const WALL = 0.034;
export const FOLDER_LIP = 0.075;

export const REPORT_H = 2.22;
export const REPORT_D = 1.14;
export const REPORT_THICK = 0.05;

const C_LEFT = "#8A6A4C";
const C_FRONT = "#6B4A34";
const C_DARK = "#5A3E2A";
const C_LABEL = "#F4EEE4";
const C_PAGES = "#F7F3EC";
const C_RINGS = "#1A120C";
const C_INK = "#1C140C";

function lambert(color, extra = {}) {
  return new THREE.MeshLambertMaterial({
    color,
    flatShading: true,
    ...extra,
  });
}

function makeSideWallGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(FOLDER_D, 0);
  shape.lineTo(FOLDER_D, FOLDER_FRONT_H);
  shape.lineTo(0, FOLDER_BACK_H);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: WALL,
    bevelEnabled: false,
    steps: 1,
  });
  geo.computeVertexNormals();
  return geo;
}

function makeFrontGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(FOLDER_W, 0);
  shape.lineTo(FOLDER_W, FOLDER_FRONT_H);
  shape.lineTo(0, FOLDER_FRONT_H);
  shape.closePath();
  const hole = new THREE.Path();
  hole.absellipse(FOLDER_W / 2, 0.42, 0.095, 0.048, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: WALL,
    bevelEnabled: false,
    steps: 1,
    curveSegments: 16,
  });
  geo.computeVertexNormals();
  return geo;
}

export function createSharedResources() {
  const pagesGeo = new THREE.BoxGeometry(
    REPORT_THICK,
    REPORT_H * 0.98,
    REPORT_D * 0.96,
  );
  const coverGeo = new THREE.BoxGeometry(0.008, REPORT_H, REPORT_D);
  const reportBackGeo = new THREE.BoxGeometry(0.008, REPORT_H, REPORT_D);
  const ringGeo = new THREE.TorusGeometry(0.036, 0.012, 6, 12);
  const reportHitGeo = new THREE.BoxGeometry(0.16, REPORT_H * 1.08, REPORT_D * 1.04);
  const reportHitMat = new THREE.MeshBasicMaterial({ visible: false });
  const pagesMat = lambert(C_PAGES);
  const reportBackMat = lambert("#E8E0D4");
  const ringMat = lambert(C_RINGS);

  const folderSideGeo = makeSideWallGeometry();
  const folderFrontGeo = makeFrontGeometry();
  const folderBottomGeo = new THREE.BoxGeometry(FOLDER_W, WALL, FOLDER_D);
  const folderBackGeo = new THREE.BoxGeometry(FOLDER_W, FOLDER_BACK_H, WALL);
  const folderLipGeo = new THREE.BoxGeometry(FOLDER_W, WALL * 1.35, FOLDER_LIP);
  const folderLabelGeo = new THREE.PlaneGeometry(0.44, 0.22);

  const folderMats = {
    left: lambert(C_LEFT),
    right: lambert(C_DARK),
    front: lambert(C_FRONT),
    back: lambert(C_DARK),
    bottom: lambert(C_DARK),
    lip: lambert(C_FRONT),
    label: lambert(C_LABEL),
  };

  return {
    pagesGeo,
    coverGeo,
    reportBackGeo,
    ringGeo,
    reportHitGeo,
    reportHitMat,
    pagesMat,
    reportBackMat,
    ringMat,
    folderSideGeo,
    folderFrontGeo,
    folderBottomGeo,
    folderBackGeo,
    folderLipGeo,
    folderLabelGeo,
    folderMats,
  };
}

export function disposeSharedResources(shared) {
  shared.pagesGeo.dispose();
  shared.coverGeo.dispose();
  shared.reportBackGeo.dispose();
  shared.ringGeo.dispose();
  shared.reportHitGeo.dispose();
  shared.reportHitMat.dispose();
  shared.pagesMat.dispose();
  shared.reportBackMat.dispose();
  shared.ringMat.dispose();
  shared.folderSideGeo.dispose();
  shared.folderFrontGeo.dispose();
  shared.folderBottomGeo.dispose();
  shared.folderBackGeo.dispose();
  shared.folderLipGeo.dispose();
  shared.folderLabelGeo.dispose();
  Object.values(shared.folderMats).forEach((mat) => mat.dispose());
}

function markFolder(mesh, folderId, pickable) {
  mesh.userData.kind = "folder";
  mesh.userData.folderId = folderId;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  pickable.push(mesh);
}

export function createFolderMesh(folderId, shared) {
  const group = new THREE.Group();
  const pickable = [];
  const { folderMats } = shared;

  const bottom = new THREE.Mesh(shared.folderBottomGeo, folderMats.bottom);
  bottom.position.set(FOLDER_W / 2, WALL / 2, FOLDER_D / 2);
  markFolder(bottom, folderId, pickable);
  group.add(bottom);

  const back = new THREE.Mesh(shared.folderBackGeo, folderMats.back);
  back.position.set(FOLDER_W / 2, FOLDER_BACK_H / 2, WALL / 2);
  markFolder(back, folderId, pickable);
  group.add(back);

  const left = new THREE.Mesh(shared.folderSideGeo, folderMats.left);
  left.rotation.y = -Math.PI / 2;
  left.position.set(WALL, 0, 0);
  markFolder(left, folderId, pickable);
  group.add(left);

  const right = new THREE.Mesh(shared.folderSideGeo, folderMats.right);
  right.rotation.y = -Math.PI / 2;
  right.position.set(FOLDER_W, 0, 0);
  markFolder(right, folderId, pickable);
  group.add(right);

  const front = new THREE.Mesh(shared.folderFrontGeo, folderMats.front);
  front.position.set(0, 0, FOLDER_D - WALL);
  markFolder(front, folderId, pickable);
  group.add(front);

  const lip = new THREE.Mesh(shared.folderLipGeo, folderMats.lip);
  lip.position.set(
    FOLDER_W / 2,
    FOLDER_FRONT_H - WALL * 0.2,
    FOLDER_D - WALL - FOLDER_LIP / 2,
  );
  markFolder(lip, folderId, pickable);
  group.add(lip);

  const plate = new THREE.Mesh(shared.folderLabelGeo, folderMats.label);
  plate.position.set(FOLDER_W / 2, 0.22, FOLDER_D + 0.003);
  plate.userData.kind = "folder";
  plate.userData.folderId = folderId;
  plate.castShadow = false;
  plate.receiveShadow = false;
  group.add(plate);
  pickable.push(plate);

  group.userData.kind = "folder";
  group.userData.folderId = folderId;
  return { group, pickable };
}

function wrapTitle(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  if (!words.length) return;
  const lines = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) break;
    } else {
      line = test;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) {
    let last = lines[maxLines - 1];
    while (last.length && ctx.measureText(`${last}…`).width > maxWidth) {
      last = last.slice(0, -1);
    }
    lines[maxLines - 1] = `${last}…`;
  }
  lines.forEach((entry, index) => {
    ctx.fillText(entry, x, y + index * lineHeight);
  });
}

export function createCoverTexture(report) {
  const jacket = coverColorFor(report.reportNo);
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 384;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = jacket;
  ctx.fillRect(0, 0, 256, 384);

  ctx.fillStyle = "rgba(28, 20, 12, 0.1)";
  ctx.fillRect(0, 0, 256, 48);

  ctx.fillStyle = C_INK;
  ctx.textAlign = "left";
  ctx.font = "bold 22px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText(`No. ${report.reportNo}`, 16, 34);

  ctx.font = "bold 24px ui-sans-serif, system-ui, sans-serif";
  wrapTitle(ctx, report.title, 16, 88, 224, 30, 4);

  ctx.font = "16px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText(String(report.year ?? ""), 16, 356);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export function createReportMesh(report, shared) {
  const group = new THREE.Group();
  const pickable = [];
  const jacket = coverColorFor(report.reportNo);
  const texture = createCoverTexture(report);
  const bindZ = -REPORT_D / 2 + 0.018;

  const pages = new THREE.Mesh(shared.pagesGeo, shared.pagesMat);
  pages.position.x = 0.006;
  pages.castShadow = true;
  pages.receiveShadow = true;
  group.add(pages);
  pickable.push(pages);

  const back = new THREE.Mesh(shared.reportBackGeo, shared.reportBackMat);
  back.position.x = 0.028;
  back.castShadow = true;
  group.add(back);
  pickable.push(back);

  const coverMat = lambert("#ffffff");
  coverMat.map = texture;
  coverMat.needsUpdate = true;
  const cover = new THREE.Mesh(shared.coverGeo, coverMat);
  cover.position.x = -0.024;
  cover.castShadow = true;
  cover.receiveShadow = true;
  group.add(cover);
  pickable.push(cover);

  const spine = new THREE.Mesh(
    new THREE.BoxGeometry(REPORT_THICK + 0.012, REPORT_H * 0.98, 0.022),
    lambert(jacket),
  );
  spine.position.set(0.002, 0, bindZ);
  spine.castShadow = true;
  group.add(spine);
  pickable.push(spine);

  for (let i = 0; i < 6; i += 1) {
    const ring = new THREE.Mesh(shared.ringGeo, shared.ringMat);
    ring.position.set(0, -REPORT_H / 2 + 0.28 + i * 0.34, bindZ);
    ring.rotation.y = Math.PI / 2;
    group.add(ring);
    pickable.push(ring);
  }

  const hit = new THREE.Mesh(shared.reportHitGeo, shared.reportHitMat);
  hit.position.x = 0;
  group.add(hit);
  pickable.push(hit);

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

export const PEEK_REST = 4;
export const PEEK_SELECT = 8;
export const PEEK_RISE = 0.68;
const PEEK_SLOT = 0.058;
const ROW_GAP_Z = 2.28;

export function folderSpacing(count) {
  if (count <= 3) return 1.72;
  if (count <= 4) return 1.42;
  if (count <= 5) return 1.22;
  return 1.05;
}

export function layoutColumns(folderCount, twoRows) {
  if (!twoRows) return folderCount;
  return Math.ceil(folderCount / 2);
}

function folderGridPosition(index, n, twoRows) {
  if (!twoRows) {
    const spacing = folderSpacing(n);
    return {
      x: -((n - 1) * spacing) / 2 + index * spacing,
      y: 0,
      z: 0,
      spacing,
    };
  }
  const cols = Math.ceil(n / 2);
  const row = index < cols ? 0 : 1;
  const col = row === 0 ? index : index - cols;
  const rowCount = row === 0 ? Math.min(cols, n) : n - cols;
  const spacing = folderSpacing(Math.max(rowCount, 1));
  return {
    x: -((rowCount - 1) * spacing) / 2 + col * spacing,
    y: 0,
    z: row === 0 ? -ROW_GAP_Z / 2 : ROW_GAP_Z / 2,
    spacing,
  };
}

export function shouldUseTwoRows(width, height) {
  const w = Math.max(width, 1);
  const h = Math.max(height, 1);
  return w < 700 || w / h < 1.15;
}

export function layoutExtents(layout) {
  const positions = Object.values(layout.folderPos);
  if (!positions.length) {
    return {
      minX: -FOLDER_W,
      maxX: FOLDER_W,
      minZ: 0,
      maxZ: FOLDER_D,
      width: FOLDER_W * 2,
      depth: FOLDER_D,
    };
  }
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const pos of positions) {
    minX = Math.min(minX, pos.x);
    maxX = Math.max(maxX, pos.x + FOLDER_W);
    minZ = Math.min(minZ, pos.z);
    maxZ = Math.max(maxZ, pos.z + FOLDER_D);
  }
  return {
    minX,
    maxX,
    minZ,
    maxZ,
    width: maxX - minX,
    depth: maxZ - minZ,
  };
}

export function computeLayout(folders, { twoRows = false } = {}) {
  const n = folders.length;
  const folderPos = {};
  const reportPos = {};
  let spacing = folderSpacing(layoutColumns(n, twoRows));

  folders.forEach((folder, index) => {
    const grid = folderGridPosition(index, n, twoRows);
    spacing = grid.spacing;
    folderPos[folder.id] = { x: grid.x, y: grid.y, z: grid.z, folder };
    const count = folder.reports.length;
    const restN = Math.min(PEEK_REST, count);
    const selectN = Math.min(PEEK_SELECT, count);
    folder.reports.forEach((report, slotIndex) => {
      const pack = (shown) =>
        FOLDER_W * 0.5 + (slotIndex - (shown - 1) / 2) * PEEK_SLOT;
      reportPos[report.reportNo] = {
        x: slotIndex < restN ? pack(restN) : FOLDER_W * 0.5,
        selectX: slotIndex < selectN ? pack(selectN) : FOLDER_W * 0.5,
        y: WALL + REPORT_H * 0.42,
        riseY: WALL + REPORT_H * 0.42 + PEEK_RISE,
        z: WALL + REPORT_D * 0.5 + 0.04,
        rx: 0.04,
        folderId: folder.id,
        slotIndex,
        count,
        visibleAtRest: slotIndex < PEEK_REST,
        visibleOnSelect: slotIndex < PEEK_SELECT,
      };
    });
  });

  return { folderPos, reportPos, folders, spacing, count: n, twoRows };
}

export function computeArchiveLayout(list) {
  const n = list.length;
  const gap = REPORT_THICK + 0.02;
  const span = Math.max(n - 1, 1) * gap;
  const reportPos = {};
  list.forEach((report, index) => {
    reportPos[report.reportNo] = {
      x: -span / 2 + index * gap,
      y: REPORT_H * 0.5,
      z: ((index % 7) - 3) * 0.038,
      rx: 0,
      ry: 0.2,
    };
  });
  return {
    reportPos,
    span,
    minX: -span / 2,
    maxX: span / 2,
    minZ: -0.14,
    maxZ: 0.14,
  };
}
