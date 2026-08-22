import { useEffect, useRef } from "react";
import * as THREE from "three";
import { reports } from "@hhcd/data";
import {
  GROUPINGS,
  groupReports,
  morphFromProgress,
} from "./grouping.js";
import {
  FOLDER_D,
  FOLDER_W,
  computeLayout,
  createFolderMesh,
  createReportMesh,
  createSharedResources,
  disposeSharedResources,
} from "./geometry.js";

function easeInOut(t) {
  const x = Math.min(1, Math.max(0, t));
  return x < 0.5 ? 2 * x * x : -1 + (4 - 2 * x) * x;
}

function liftCurve(t) {
  if (t <= 0) return 0;
  if (t >= 1) return 0;
  if (t < 0.22) return t / 0.22;
  if (t > 0.78) return (1 - t) / 0.22;
  return 1;
}

function sideSign(x) {
  return x < 0 ? -1 : 1;
}

const EXIT_X = 12;
const LIFT = 2.7;
const SELECT_Z = 0.78;

const CAM = {
  theme: {
    pos: new THREE.Vector3(-5.4, 6.9, 12.6),
    look: new THREE.Vector3(0, 1.25, 0.35),
  },
  year: {
    pos: new THREE.Vector3(-3.6, 5.8, 12.2),
    look: new THREE.Vector3(0, 1.2, 0.2),
  },
  type: {
    pos: new THREE.Vector3(-2.2, 5.4, 13.4),
    look: new THREE.Vector3(0, 1.15, 0.1),
  },
};

function lerpCam(fromId, toId, t, outPos, outLook) {
  outPos.lerpVectors(CAM[fromId].pos, CAM[toId].pos, t);
  outLook.lerpVectors(CAM[fromId].look, CAM[toId].look, t);
}

function folderTarget(fromLayout, toLayout, id, entry) {
  const from = fromLayout.folderPos[id];
  const to = toLayout.folderPos[id];
  if (to) entry.restX = to.x;
  else if (from) entry.restX = from.x;

  if (to) {
    return { x: to.x, y: 0, z: 0, meta: to.folder, onStage: true };
  }
  const restX = entry.restX ?? 0;
  return {
    x: restX + sideSign(restX) * EXIT_X,
    y: 0,
    z: 0,
    meta: from?.folder ?? null,
    onStage: false,
  };
}

export default function ArchiveScene({
  progress,
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
  const progressRef = useRef(progress);
  const groupingRef = useRef(grouping);
  const reduceRef = useRef(reduceMotion);
  const selectedFolderRef = useRef(selectedFolderId);
  const selectedReportRef = useRef(selectedReportNo);
  const onFolderRef = useRef(onSelectFolder);
  const onReportRef = useRef(onSelectReport);

  progressRef.current = progress;
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
      22,
      Math.max(mount.clientWidth, 1) / Math.max(mount.clientHeight, 1),
      0.1,
      80,
    );
    camera.position.copy(CAM.theme.pos);
    camera.lookAt(CAM.theme.look);

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
    sun.shadow.camera.left = -14;
    sun.shadow.camera.right = 14;
    sun.shadow.camera.top = 12;
    sun.shadow.camera.bottom = -8;
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
      layouts[item.id] = computeLayout(groupReports(item.id));
    }

    const allFolderIds = new Set();
    for (const layout of Object.values(layouts)) {
      for (const id of Object.keys(layout.folderPos)) allFolderIds.add(id);
    }

    const shared = createSharedResources();
    const folders = new Map();
    const labelNodes = new Map();
    for (const id of allFolderIds) {
      const { group, pickable } = createFolderMesh(id, shared);
      scene.add(group);
      folders.set(id, { group, pickable, id, parked: true, restX: 0 });

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

    for (const report of reports) {
      const { group, pickable, texture, coverMat } = createReportMesh(
        report,
        shared,
      );
      const start = layouts.theme.reportPos[report.reportNo];
      const folderStart = start
        ? layouts.theme.folderPos[start.folderId]
        : null;
      if (start && folderStart) {
        group.position.set(
          folderStart.x + start.x,
          folderStart.y + start.y,
          folderStart.z + start.z,
        );
        group.rotation.x = start.rx;
      }
      scene.add(group);
      pickables.push(...pickable);
      reportEntries.push({
        report,
        group,
        pickable,
        texture,
        coverMat,
        id: report.reportNo,
      });
    }

    for (const [id, entry] of folders) {
      const start = layouts.theme.folderPos[id];
      if (start) {
        entry.group.position.set(start.x, start.y, start.z);
        entry.group.visible = true;
        entry.parked = false;
        entry.restX = start.x;
      } else {
        entry.parked = true;
        entry.group.position.x = EXIT_X;
        entry.group.visible = false;
      }
    }

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const camPos = new THREE.Vector3();
    const camLook = new THREE.Vector3();
    const projected = new THREE.Vector3();

    let hovered = null;
    let dragging = false;
    let downX = 0;
    let downY = 0;
    let raf = 0;

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
    };
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (sun.shadow.map && !sun.userData.hardened) {
        sun.shadow.map.texture.magFilter = THREE.NearestFilter;
        sun.shadow.map.texture.minFilter = THREE.NearestFilter;
        sun.userData.hardened = true;
      }

      const reduce = reduceRef.current;
      const morph = reduce
        ? {
            from: groupingRef.current,
            to: groupingRef.current,
            t: 0,
            grouping: groupingRef.current,
          }
        : morphFromProgress(progressRef.current);
      const blend = easeInOut(morph.t);
      const fromLayout = layouts[morph.from];
      const toLayout = layouts[morph.to];
      const selectedFolder = selectedFolderRef.current;
      const selectedReport = selectedReportRef.current;
      const shuffling = morph.from !== morph.to && blend > 0 && blend < 1;

      lerpCam(morph.from, morph.to, blend, camPos, camLook);
      if (reduce) {
        camera.position.copy(camPos);
      } else {
        camera.position.lerp(camPos, 0.08);
      }
      camera.lookAt(camLook);

      for (const [id, entry] of folders) {
        const slide = folderTarget(fromLayout, toLayout, id, entry);
        const label = labelNodes.get(id);
        const selected = id === selectedFolder && slide.onStage && !shuffling;
        const targetX = slide.x;
        const targetY = selected ? 0.04 : 0;
        const targetZ = selected ? SELECT_Z : 0;
        const follow = reduce ? 1 : 0.08;

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
        entry.group.visible = !entry.parked && Math.abs(entry.group.position.x) < 14;

        if (!label) continue;
        const onStage = Math.abs(entry.group.position.x) < 5.8;
        if (!entry.group.visible || !onStage) {
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
        const from = fromLayout.reportPos[entry.id];
        const to = toLayout.reportPos[entry.id];
        if (!from && !to) continue;
        const dest = to ?? from;
        const origin = from ?? to;
        const isReport = entry.id === selectedReport;
        const inSelected = dest.folderId === selectedFolder && !shuffling;
        const isHover =
          hovered?.kind === "report" && hovered.reportNo === entry.id;
        const fan = inSelected
          ? (dest.slotIndex - (dest.count - 1) / 2) * 0.04
          : 0;

        let targetX;
        let targetY;
        let targetZ;
        let targetRx;
        let follow;

        if (shuffling) {
          const fromFolder = fromLayout.folderPos[origin.folderId];
          const toFolder = toLayout.folderPos[dest.folderId];
          const ax = (fromFolder?.x ?? 0) + origin.x;
          const ay = origin.y;
          const az = (fromFolder?.z ?? 0) + origin.z;
          const bx = (toFolder?.x ?? 0) + dest.x;
          const by = dest.y;
          const bz = (toFolder?.z ?? 0) + dest.z;
          targetX = THREE.MathUtils.lerp(ax, bx, blend);
          targetY = THREE.MathUtils.lerp(ay, by, blend) + liftCurve(blend) * LIFT;
          targetZ = THREE.MathUtils.lerp(az, bz, blend);
          targetRx = THREE.MathUtils.lerp(origin.rx, dest.rx, blend);
          follow = reduce ? 1 : 0.16;
        } else {
          const folderEntry = folders.get(dest.folderId);
          const fp = folderEntry?.group.position ?? { x: 0, y: 0, z: 0 };
          targetX = fp.x + dest.x;
          targetY = fp.y + dest.y + (isReport ? 0.1 : 0) + (isHover ? 0.04 : 0);
          targetZ =
            fp.z + dest.z + fan + (isReport ? 0.7 : inSelected ? 0.12 : 0);
          targetRx = isReport ? 0.02 : dest.rx;
          follow = reduce ? 1 : 0.2;
        }

        const g = entry.group;
        g.position.x += (targetX - g.position.x) * follow;
        g.position.y += (targetY - g.position.y) * follow;
        g.position.z += (targetZ - g.position.z) * follow;
        g.rotation.x += (targetRx - g.rotation.x) * follow;
        const s = isReport ? 1.05 : 1;
        g.scale.setScalar(g.scale.x + (s - g.scale.x) * follow);
      }

      renderer.render(scene, camera);
    };

    tick();

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
