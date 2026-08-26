import { useEffect, useRef } from "react";
import * as THREE from "three";
import { reports } from "@hhcd/data";
import { GROUPINGS, groupReports } from "./grouping.js";
import {
  FOLDER_BACK_H,
  FOLDER_D,
  FOLDER_W,
  PEEK_SELECT,
  computeLayout,
  createFolderMesh,
  createReportMesh,
  createSharedResources,
  disposeSharedResources,
  layoutExtents,
  shouldUseTwoRows,
} from "./geometry.js";

function easeInOut(t) {
  const x = Math.min(1, Math.max(0, t));
  return x < 0.5 ? 2 * x * x : -1 + (4 - 2 * x) * x;
}

function sideSign(x) {
  return x < 0 ? -1 : 1;
}

const EXIT_X = 12;
const SELECT_Z = 0.78;
const MORPH_MS = 900;
const CAM_FOV = 22;

function folderTarget(fromLayout, toLayout, id, entry) {
  const from = fromLayout.folderPos[id];
  const to = toLayout.folderPos[id];
  if (to) {
    entry.restX = to.x;
    entry.restZ = to.z;
  } else if (from) {
    entry.restX = from.x;
    entry.restZ = from.z;
  }

  if (to) {
    return { x: to.x, y: 0, z: to.z, meta: to.folder, onStage: true };
  }
  const restX = entry.restX ?? 0;
  const restZ = entry.restZ ?? 0;
  return {
    x: restX + sideSign(restX) * EXIT_X,
    y: 0,
    z: restZ,
    meta: from?.folder ?? null,
    onStage: false,
  };
}

function fitCamera(layout, aspect, selected, outPos, outLook) {
  const ext = layoutExtents(layout);
  const padX = 1.05;
  const padZ = selected ? 1.25 : 0.85;
  const worldW = ext.width + padX * 2;
  const worldH = FOLDER_BACK_H + 1.45;
  const worldD = ext.depth + padZ * 2 + (selected ? SELECT_Z : 0);
  const fov = CAM_FOV * (Math.PI / 180);
  const distX = worldW / 2 / (Math.tan(fov / 2) * Math.max(aspect, 0.4));
  const distY = worldH / 2 / Math.tan(fov / 2);
  const distZ = worldD / 2 / Math.tan(fov / 2);
  const dist = Math.max(distX, distY, distZ, 7.2) * 1.18;

  outLook.set(
    (ext.minX + ext.maxX) / 2,
    1.12,
    (ext.minZ + ext.maxZ) / 2 + (selected ? SELECT_Z * 0.28 : 0),
  );
  outPos.set(
    outLook.x - 0.36 * dist,
    outLook.y + 0.5 * dist,
    outLook.z + dist,
  );
}

function fitShadow(sun, layout) {
  const ext = layoutExtents(layout);
  const pad = 3.2;
  sun.shadow.camera.left = ext.minX - pad;
  sun.shadow.camera.right = ext.maxX + pad;
  sun.shadow.camera.top = Math.max(ext.depth, 8) + pad;
  sun.shadow.camera.bottom = -Math.max(ext.depth, 6) - pad;
  sun.shadow.camera.updateProjectionMatrix();
  sun.target.position.set((ext.minX + ext.maxX) / 2, 0, (ext.minZ + ext.maxZ) / 2);
  sun.target.updateMatrixWorld();
}

export default function ArchiveScene({
  grouping,
  reduceMotion,
  selectedFolderId,
  selectedReportNo,
  onSelectFolder,
  onSelectReport,
  onWebglError,
}) {
  const mountRef = useRef(null);
  const labelRef = useRef(null);
  const onErrorRef = useRef(onWebglError);
  const groupingRef = useRef(grouping);
  const reduceRef = useRef(reduceMotion);
  const selectedFolderRef = useRef(selectedFolderId);
  const selectedReportRef = useRef(selectedReportNo);
  const onFolderRef = useRef(onSelectFolder);
  const onReportRef = useRef(onSelectReport);

  groupingRef.current = grouping;
  reduceRef.current = reduceMotion;
  selectedFolderRef.current = selectedFolderId;
  selectedReportRef.current = selectedReportNo;
  onFolderRef.current = onSelectFolder;
  onReportRef.current = onSelectReport;
  onErrorRef.current = onWebglError;

  useEffect(() => {
    const mount = mountRef.current;
    const labelRoot = labelRef.current;
    if (!mount || !labelRoot) return undefined;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch {
      onErrorRef.current?.();
      return undefined;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#C9DCE0");

    const camera = new THREE.PerspectiveCamera(
      CAM_FOV,
      Math.max(mount.clientWidth, 1) / Math.max(mount.clientHeight, 1),
      0.1,
      80,
    );

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.BasicShadowMap;
    renderer.domElement.setAttribute("aria-hidden", "true");
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.touchAction = "pan-y";
    mount.appendChild(renderer.domElement);

    const hemi = new THREE.HemisphereLight("#f3f6f4", "#c4b29a", 0.38);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight("#ffffff", 1.85);
    sun.position.set(-8, 14, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 42;
    sun.shadow.bias = -0.0008;
    sun.shadow.normalBias = 0.02;
    sun.shadow.radius = 0;
    scene.add(sun);
    scene.add(sun.target);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(48, 48),
      new THREE.MeshLambertMaterial({ color: "#B9CED3", flatShading: true }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    scene.add(ground);

    const layouts = {};
    for (const item of GROUPINGS) {
      const foldersFor = groupReports(item.id);
      layouts[item.id] = {
        single: computeLayout(foldersFor, { twoRows: false }),
        two: computeLayout(foldersFor, { twoRows: true }),
      };
    }

    const allFolderIds = new Set();
    for (const pair of Object.values(layouts)) {
      for (const id of Object.keys(pair.single.folderPos)) allFolderIds.add(id);
      for (const id of Object.keys(pair.two.folderPos)) allFolderIds.add(id);
    }

    const shared = createSharedResources();
    const folders = new Map();
    const labelNodes = new Map();
    for (const id of allFolderIds) {
      const { group, pickable } = createFolderMesh(id, shared);
      scene.add(group);
      folders.set(id, {
        group,
        pickable,
        id,
        parked: true,
        restX: 0,
        restZ: 0,
      });

      const el = document.createElement("div");
      el.className = "scene-label";
      el.setAttribute("aria-hidden", "true");
      labelRoot.appendChild(el);
      labelNodes.set(id, el);
    }

    const reportEntries = [];
    const pickables = [];

    for (const folder of folders.values()) {
      pickables.push(...folder.pickable);
    }

    const startLayout = layouts.theme.single;
    for (const report of reports) {
      const { group, pickable, texture, coverMat } = createReportMesh(
        report,
        shared,
      );
      const start = startLayout.reportPos[report.reportNo];
      const folderEntry = start ? folders.get(start.folderId) : null;
      if (start && folderEntry) {
        folderEntry.group.add(group);
        group.position.set(start.x, start.y, start.z);
        group.rotation.x = start.rx;
        group.visible = start.visibleAtRest;
      } else {
        scene.add(group);
        group.visible = false;
      }
      pickables.push(...pickable);
      reportEntries.push({
        report,
        group,
        pickable,
        texture,
        coverMat,
        id: report.reportNo,
        folderId: start?.folderId ?? null,
      });
    }

    for (const [id, entry] of folders) {
      const start = startLayout.folderPos[id];
      if (start) {
        entry.group.position.set(start.x, start.y, start.z);
        entry.group.visible = true;
        entry.parked = false;
        entry.restX = start.x;
        entry.restZ = start.z;
      } else {
        entry.parked = true;
        entry.group.position.set(EXIT_X, 0, 0);
        entry.group.visible = false;
      }
    }

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const camPos = new THREE.Vector3();
    const camLook = new THREE.Vector3();
    const projected = new THREE.Vector3();

    fitCamera(startLayout, camera.aspect, false, camPos, camLook);
    camera.position.copy(camPos);
    camera.lookAt(camLook);
    fitShadow(sun, startLayout);

    let hovered = null;
    let dragging = false;
    let downX = 0;
    let downY = 0;
    let raf = 0;
    let twoRows = shouldUseTwoRows(mount.clientWidth, mount.clientHeight);
    let transFrom = "theme";
    let transTo = "theme";
    let transStart = 0;
    let lastShadowKey = "";

    const setPointer = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const hitTest = () => {
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(pickables, false);
      return hits[0] ?? null;
    };

    const onPointerDown = (event) => {
      dragging = false;
      downX = event.clientX;
      downY = event.clientY;
    };

    const onPointerMove = (event) => {
      if (
        event.buttons &&
        (event.clientX - downX) ** 2 + (event.clientY - downY) ** 2 > 25
      ) {
        dragging = true;
      }
      setPointer(event);
      const hit = hitTest();
      const next = hit?.object.userData ?? null;
      hovered = next;
      const over =
        next?.kind === "report" || next?.kind === "folder" ? "pointer" : "";
      renderer.domElement.style.cursor = over;
    };

    const onPointerUp = (event) => {
      if (dragging) return;
      setPointer(event);
      const hit = hitTest();
      const data = hit?.object.userData;
      if (data?.kind === "report") {
        onReportRef.current(data.reportNo);
      } else if (data?.kind === "folder") {
        onFolderRef.current(data.folderId);
      } else {
        onFolderRef.current(null);
      }
    };

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerup", onPointerUp);

    const resize = () => {
      const w = Math.max(mount.clientWidth, 1);
      const h = Math.max(mount.clientHeight, 1);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      twoRows = shouldUseTwoRows(w, h);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    const attachToFolder = (entry, folderId, pose) => {
      const folderEntry = folders.get(folderId);
      if (!folderEntry || !pose) return;
      if (entry.group.parent !== folderEntry.group) {
        folderEntry.group.add(entry.group);
        entry.folderId = folderId;
      }
    };

    const tick = (now) => {
      raf = requestAnimationFrame(tick);
      if (sun.shadow.map && !sun.userData.hardened) {
        sun.shadow.map.texture.magFilter = THREE.NearestFilter;
        sun.shadow.map.texture.minFilter = THREE.NearestFilter;
        sun.userData.hardened = true;
      }

      const reduce = reduceRef.current;
      const nextGrouping = groupingRef.current;
      if (nextGrouping !== transTo) {
        transFrom = transTo;
        transTo = nextGrouping;
        transStart = now;
      }

      const elapsed = now - transStart;
      const blend = reduce
        ? 1
        : easeInOut(transFrom === transTo ? 1 : Math.min(1, elapsed / MORPH_MS));
      const shuffling = transFrom !== transTo && blend < 1;
      const rowKey = twoRows ? "two" : "single";
      const fromLayout = layouts[transFrom][rowKey];
      const toLayout = layouts[transTo][rowKey];
      const selectedFolder = selectedFolderRef.current;
      const selectedReport = selectedReportRef.current;

      fitCamera(toLayout, camera.aspect, Boolean(selectedFolder), camPos, camLook);
      if (reduce) {
        camera.position.copy(camPos);
      } else {
        camera.position.lerp(camPos, 0.1);
      }
      camera.lookAt(camLook);

      const shadowKey = `${transTo}:${rowKey}:${toLayout.count}`;
      if (shadowKey !== lastShadowKey) {
        fitShadow(sun, toLayout);
        lastShadowKey = shadowKey;
      }

      for (const [id, entry] of folders) {
        const slide = folderTarget(fromLayout, toLayout, id, entry);
        const label = labelNodes.get(id);
        const selected = id === selectedFolder && slide.onStage && !shuffling;
        const targetX = slide.x;
        const targetY = selected ? 0.04 : 0;
        const targetZ = slide.z + (selected ? SELECT_Z : 0);
        const follow = reduce ? 1 : 0.09;

        if (slide.onStage) {
          if (entry.parked) {
            entry.group.position.set(
              targetX + sideSign(targetX) * EXIT_X,
              targetY,
              targetZ,
            );
            entry.parked = false;
            entry.group.visible = true;
          }
          if (reduce) {
            entry.group.position.set(targetX, targetY, targetZ);
          } else {
            entry.group.position.x += (targetX - entry.group.position.x) * follow;
            entry.group.position.y += (targetY - entry.group.position.y) * follow;
            entry.group.position.z += (targetZ - entry.group.position.z) * follow;
          }
        } else if (reduce) {
          entry.group.position.set(targetX, targetY, targetZ);
          entry.parked = true;
        } else {
          entry.group.position.x += (targetX - entry.group.position.x) * follow;
          entry.group.position.y += (targetY - entry.group.position.y) * follow;
          entry.group.position.z += (targetZ - entry.group.position.z) * follow;
          if (Math.abs(entry.group.position.x) > 11) entry.parked = true;
        }
        entry.group.visible =
          !entry.parked && Math.abs(entry.group.position.x) < 14;

        if (!label) continue;
        const nearRest =
          slide.onStage &&
          Math.abs(entry.group.position.x - targetX) < 0.55 &&
          Math.abs(entry.group.position.z - targetZ) < 0.55;
        if (!entry.group.visible || !nearRest) {
          label.style.opacity = "0";
          continue;
        }
        label.textContent = slide.meta
          ? `${slide.meta.label} (${slide.meta.count})`
          : "";
        label.classList.toggle("is-selected", selected);
        projected.set(
          entry.group.position.x + FOLDER_W * 0.5,
          -0.08,
          entry.group.position.z + FOLDER_D * 0.55,
        );
        projected.project(camera);
        const lx = (projected.x * 0.5 + 0.5) * mount.clientWidth;
        const ly = (-projected.y * 0.5 + 0.5) * mount.clientHeight;
        label.style.opacity = projected.z > 1 ? "0" : "1";
        label.style.transform = `translate(-50%, 0) translate(${lx}px, ${ly}px)`;
      }

      for (const entry of reportEntries) {
        const dest = toLayout.reportPos[entry.id];
        if (!dest) {
          entry.group.visible = false;
          continue;
        }
        attachToFolder(entry, dest.folderId, dest);
        const folderEntry = folders.get(dest.folderId);
        const isReport = entry.id === selectedReport;
        const inSelected =
          dest.folderId === selectedFolder && !shuffling && folderEntry?.group.visible;
        const isHover =
          hovered?.kind === "report" && hovered.reportNo === entry.id;
        const show =
          Boolean(folderEntry?.group.visible) &&
          (isReport ||
            (inSelected ? dest.visibleOnSelect : dest.visibleAtRest));
        entry.group.visible = show;

        const shown = Math.min(PEEK_SELECT, dest.count);
        const fan =
          inSelected && dest.visibleOnSelect
            ? (dest.slotIndex - (shown - 1) / 2) * 0.04
            : 0;
        const targetX = inSelected ? dest.selectX : dest.x;
        const targetY = dest.y + (isReport ? 0.1 : 0) + (isHover && show ? 0.04 : 0);
        const targetZ =
          dest.z + fan + (isReport ? 0.55 : inSelected ? 0.1 : 0);
        const targetRx = isReport ? 0.02 : dest.rx;
        const g = entry.group;
        if (!show) {
          g.position.set(dest.x, dest.y, dest.z);
          g.rotation.x = dest.rx;
          g.scale.setScalar(1);
          continue;
        }
        const follow = reduce ? 1 : 0.18;
        g.position.x += (targetX - g.position.x) * follow;
        g.position.y += (targetY - g.position.y) * follow;
        g.position.z += (targetZ - g.position.z) * follow;
        g.rotation.x += (targetRx - g.rotation.x) * follow;
        const s = isReport ? 1.05 : 1;
        g.scale.setScalar(g.scale.x + (s - g.scale.x) * follow);
      }

      renderer.render(scene, camera);
    };

    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      const sharedGeos = new Set([
        shared.pagesGeo,
        shared.coverGeo,
        shared.reportBackGeo,
        shared.ringGeo,
        shared.folderSideGeo,
        shared.folderFrontGeo,
        shared.folderBottomGeo,
        shared.folderBackGeo,
        shared.folderLabelGeo,
      ]);
      const sharedMats = new Set([
        shared.pagesMat,
        shared.reportBackMat,
        shared.ringMat,
        ...Object.values(shared.folderMats),
      ]);
      const disposeObject = (root) => {
        root.traverse((obj) => {
          if (obj.geometry && !sharedGeos.has(obj.geometry)) obj.geometry.dispose();
          if (obj.material && !sharedMats.has(obj.material)) {
            obj.material.dispose?.();
          }
        });
      };
      for (const entry of reportEntries) {
        disposeObject(entry.group);
        entry.texture.dispose();
      }
      for (const folder of folders.values()) {
        disposeObject(folder.group);
      }
      disposeSharedResources(shared);
      ground.geometry.dispose();
      ground.material.dispose();
      renderer.dispose();
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
      labelRoot.replaceChildren();
    };
  }, []);

  return (
    <div className="scene">
      <div ref={mountRef} className="scene-mount" />
      <div ref={labelRef} className="scene-labels" aria-hidden="true" />
    </div>
  );
}
