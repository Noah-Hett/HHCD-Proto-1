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

export default function ArchiveScene({
  progress,
  grouping,
  reduceMotion,
  pauseIdle,
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
  const pauseRef = useRef(pauseIdle);
  const selectedFolderRef = useRef(selectedFolderId);
  const selectedReportRef = useRef(selectedReportNo);
  const onFolderRef = useRef(onSelectFolder);
  const onReportRef = useRef(onSelectReport);

  progressRef.current = progress;
  groupingRef.current = grouping;
  reduceRef.current = reduceMotion;
  pauseRef.current = pauseIdle;
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
    renderer.domElement.setAttribute("aria-hidden", "true");
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.touchAction = "pan-y";
    mount.appendChild(renderer.domElement);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40),
      new THREE.MeshBasicMaterial({ color: "#C9DCE0" }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.03;
    scene.add(ground);

    const layouts = {};
    for (const item of GROUPINGS) {
      layouts[item.id] = computeLayout(groupReports(item.id));
    }

    const allFolderIds = new Set();
    for (const layout of Object.values(layouts)) {
      for (const id of Object.keys(layout.folderPos)) allFolderIds.add(id);
    }

    const folders = new Map();
    const labelNodes = new Map();
    for (const id of allFolderIds) {
      const { group, pickable } = createFolderMesh(id);
      group.scale.setScalar(0.001);
      scene.add(group);
      folders.set(id, { group, pickable, id });

      const el = document.createElement("div");
      el.className = "scene-label";
      el.setAttribute("aria-hidden", "true");
      labelRoot.appendChild(el);
      labelNodes.set(id, el);
    }

    const shared = createSharedResources();
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
      if (start) {
        group.position.set(start.x, start.y, start.z);
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
        entry.group.scale.setScalar(1);
        entry.group.visible = true;
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
    const clock = new THREE.Clock();

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
      const time = clock.getElapsedTime();
      const reduce = reduceRef.current;
      const pause = pauseRef.current;
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

      lerpCam(morph.from, morph.to, blend, camPos, camLook);
      if (reduce) {
        camera.position.copy(camPos);
      } else {
        camera.position.lerp(camPos, 0.08);
      }
      camera.lookAt(camLook);

      const activeIds = new Set([
        ...Object.keys(fromLayout.folderPos),
        ...Object.keys(toLayout.folderPos),
      ]);

      for (const [id, entry] of folders) {
        const from = fromLayout.folderPos[id];
        const to = toLayout.folderPos[id];
        let x = 0;
        let y = 0;
        let z = 0;
        let scale = 0;
        if (from && to) {
          x = THREE.MathUtils.lerp(from.x, to.x, blend);
          y = THREE.MathUtils.lerp(from.y, to.y, blend);
          z = THREE.MathUtils.lerp(from.z, to.z, blend);
          scale = 1;
        } else if (to) {
          x = to.x;
          y = to.y;
          z = to.z;
          scale = 0.001 + 0.999 * blend;
        } else if (from) {
          x = from.x;
          y = from.y;
          z = from.z;
          scale = 1 - 0.999 * blend;
        }

        const selected = id === selectedFolder;
        const bob =
          pause || reduce ? 0 : Math.sin(time * 0.45 + x) * 0.02;
        const targetY = y + bob + (selected ? 0.16 : 0);
        const targetZ = z + (selected ? 0.58 : 0);
        const targetS = scale * (selected ? 1.04 : 1);

        const follow = reduce ? 1 : 0.1;
        entry.group.position.x += (x - entry.group.position.x) * follow;
        entry.group.position.y += (targetY - entry.group.position.y) * follow;
        entry.group.position.z += (targetZ - entry.group.position.z) * follow;
        entry.group.scale.setScalar(
          entry.group.scale.x + (targetS - entry.group.scale.x) * follow,
        );
        entry.group.visible = scale > 0.02;

        const label = labelNodes.get(id);
        if (!label) continue;
        if (!entry.group.visible) {
          label.style.opacity = "0";
          continue;
        }
        const folderMeta = (to ?? from)?.folder;
        label.textContent = folderMeta
          ? `${folderMeta.label} (${folderMeta.count})`
          : "";
        label.classList.toggle("is-selected", selected);
        projected.set(
          entry.group.position.x + FOLDER_W * 0.5,
          -0.12,
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
        const a = from ?? to;
        const b = to ?? from;
        const flying = Boolean(from && to && morph.t > 0 && morph.from !== morph.to);
        const x = THREE.MathUtils.lerp(a.x, b.x, blend);
        const y = THREE.MathUtils.lerp(a.y, b.y, blend);
        const z = THREE.MathUtils.lerp(a.z, b.z, blend);
        const rx = THREE.MathUtils.lerp(a.rx, b.rx, blend);
        const arc = flying && !reduce ? Math.sin(Math.PI * blend) * 1.35 : 0;
        const dest = b;
        const inSelected = dest.folderId === selectedFolder;
        const isReport = entry.id === selectedReport;
        const isHover =
          hovered?.kind === "report" && hovered.reportNo === entry.id;
        const fan = inSelected
          ? (dest.slotIndex - (dest.count - 1) / 2) * 0.055
          : 0;
        const targetX = x;
        const targetY =
          y + arc + (isReport ? 0.28 : inSelected ? 0.1 : 0) + (isHover ? 0.06 : 0);
        const targetZ = z + fan + (isReport ? 0.92 : inSelected ? 0.22 : 0);
        const targetRx = isReport ? 0.02 : rx;
        const follow = reduce ? 1 : flying ? 0.14 : 0.1;
        const g = entry.group;
        g.position.x += (targetX - g.position.x) * follow;
        g.position.y += (targetY - g.position.y) * follow;
        g.position.z += (targetZ - g.position.z) * follow;
        g.rotation.x += (targetRx - g.rotation.x) * follow;
        const s = isReport ? 1.06 : 1;
        g.scale.setScalar(g.scale.x + (s - g.scale.x) * follow);
      }

      // Hide labels for folders not in the current morph pair
      for (const id of folders.keys()) {
        if (activeIds.has(id)) continue;
        const label = labelNodes.get(id);
        if (label) label.style.opacity = "0";
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
        shared.backGeo,
        shared.ringGeo,
      ]);
      const sharedMats = new Set([
        shared.pagesMat,
        shared.backMat,
        shared.ringMat,
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
