"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Crosshair, Pause, Play, ZoomIn, ZoomOut } from "lucide-react";

type SubscriberTerrainPoint = {
  name: string;
  total: number;
  active: number;
  forfait: number;
  resigned: number;
};

export function SubscriberTerrain3D({ data }: { data: SubscriberTerrainPoint[] }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState<SubscriberTerrainPoint | null>(null);
  const [sceneReady, setSceneReady] = useState(false);
  const [webglUnavailable, setWebglUnavailable] = useState(false);
  const points = useMemo(() => data.filter((point) => point.total > 0), [data]);
  const pointsKey = points.map((point) => `${point.name}:${point.total}`).join("|");
  const isPlayingRef = useRef(isPlaying);
  const resetViewRef = useRef<() => void>(() => {});
  const adjustZoomRef = useRef<(zoomIn: boolean) => void>(() => {});

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || points.length === 0) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch {
      setWebglUnavailable(true);
      return;
    }

    setWebglUnavailable(false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.domElement.className = "absolute inset-0 h-full w-full touch-none";
    renderer.domElement.setAttribute("aria-label", "Relief 3D des abonnés par commune");
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#b9d7cf");
    scene.fog = new THREE.Fog("#b9d7cf", 28, 86);
    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 120);

    scene.add(new THREE.HemisphereLight("#f3fff8", "#214b45", 2.2));
    const sun = new THREE.DirectionalLight("#fff2ca", 3.1);
    sun.position.set(-8, 18, 7);
    scene.add(sun);

    const length = Math.max(38, points.length * 4.5);
    const width = 24;
    const spacing = Math.min(4.5, length / (points.length + 2));
    const maxTotal = Math.max(...points.map((point) => point.total), 1);
    const locations = points.map((point, index) => ({
      point,
      x: (index - (points.length - 1) / 2) * spacing,
      z: Math.sin(index * 2.35) * 4.2,
      height: 1.5 + (point.total / maxTotal) * 4.5,
    }));

    const terrainHeight = (x: number, z: number) => {
      let height = 0.08 * Math.sin(x * 0.24) * Math.cos(z * 0.42);
      for (const location of locations) {
        const dx = (x - location.x) / Math.max(spacing * 0.78, 2.2);
        const dz = (z - location.z) / 3.1;
        height += location.height * Math.exp(-(dx * dx + dz * dz) * 1.2);
      }
      return height;
    };

    const terrainGeometry = new THREE.PlaneGeometry(length, width, 160, 72);
    const positions = terrainGeometry.attributes.position as THREE.BufferAttribute;
    const colors: number[] = [];
    const low = new THREE.Color("#27695a");
    const middle = new THREE.Color("#67a86d");
    const high = new THREE.Color("#e0c879");
    for (let index = 0; index < positions.count; index += 1) {
      const x = positions.getX(index);
      const z = -positions.getY(index);
      const height = terrainHeight(x, z);
      positions.setZ(index, height);
      const color = height < 2.1
        ? low.clone().lerp(middle, Math.max(0, height / 2.1))
        : middle.clone().lerp(high, Math.min(1, (height - 2.1) / 4));
      colors.push(color.r, color.g, color.b);
    }
    terrainGeometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    terrainGeometry.computeVertexNormals();
    const terrain = new THREE.Mesh(
      terrainGeometry,
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 }),
    );
    terrain.rotation.x = -Math.PI / 2;
    scene.add(terrain);

    const markers: THREE.Mesh[] = [];
    const markerGeometry = new THREE.SphereGeometry(0.34, 16, 12);
    const markerMaterial = new THREE.MeshStandardMaterial({
      color: "#f8c34a",
      emissive: "#a55c18",
      emissiveIntensity: 0.65,
      roughness: 0.32,
    });
    for (const location of locations) {
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.035, 0.9, 8),
        new THREE.MeshStandardMaterial({ color: "#fff0b5", emissive: "#b88734", emissiveIntensity: 0.35 }),
      );
      stem.position.set(location.x, terrainHeight(location.x, location.z) + 0.45, location.z);
      scene.add(stem);

      const marker = new THREE.Mesh(markerGeometry, markerMaterial.clone());
      marker.position.set(location.x, terrainHeight(location.x, location.z) + 1, location.z);
      marker.userData.point = location.point;
      markers.push(marker);
      scene.add(marker);
    }

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const initialDistance = Math.max(28, length * 0.68);
    camera.position.set(0, initialDistance * 0.46, initialDistance);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = true;
    controls.screenSpacePanning = false;
    controls.minDistance = Math.max(5, spacing * 1.2);
    controls.maxDistance = Math.max(100, length * 2);
    controls.minPolarAngle = 0.12;
    controls.maxPolarAngle = Math.PI / 2.02;
    controls.autoRotateSpeed = 0.5;
    controls.update();
    controls.saveState();
    resetViewRef.current = () => controls.reset();
    adjustZoomRef.current = (zoomIn) => {
      const offset = camera.position.clone().sub(controls.target);
      offset.multiplyScalar(zoomIn ? 0.82 : 1.22);
      camera.position.copy(controls.target).add(offset);
      controls.update();
    };

    const handlePointerMove = (event: PointerEvent) => {
      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const match = raycaster.intersectObjects(markers, false)[0]?.object.userData.point as SubscriberTerrainPoint | undefined;
      setHoveredPoint((current) => current?.name === match?.name ? current : match ?? null);
    };
    const handlePointerLeave = () => {
      setHoveredPoint(null);
    };
    renderer.domElement.addEventListener("pointermove", handlePointerMove);
    renderer.domElement.addEventListener("pointerleave", handlePointerLeave);

    const resizeObserver = new ResizeObserver(() => {
      const { width: hostWidth, height: hostHeight } = host.getBoundingClientRect();
      if (!hostWidth || !hostHeight) return;
      camera.aspect = hostWidth / hostHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(hostWidth, hostHeight, false);
    });
    resizeObserver.observe(host);

    let animationFrame = 0;
    const animate = () => {
      animationFrame = window.requestAnimationFrame(animate);
      controls.autoRotate = isPlayingRef.current;
      controls.update();
      renderer.render(scene, camera);
    };
    animationFrame = window.requestAnimationFrame(animate);
    setSceneReady(true);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointermove", handlePointerMove);
      renderer.domElement.removeEventListener("pointerleave", handlePointerLeave);
      controls.dispose();
      terrainGeometry.dispose();
      terrain.material.dispose();
      markerGeometry.dispose();
      markerMaterial.dispose();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh && object !== terrain) {
          object.geometry.dispose();
          if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
          else object.material.dispose();
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
      setSceneReady(false);
    };
  }, [points, pointsKey]);

  return (
    <section className="overflow-hidden rounded-2xl border border-[#d7e4df] bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-[#e8efec] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <div>
          <h3 className="mt-1 text-xl font-black text-[#163b32]">Relief des abonnés</h3>
          <p className="mt-1 text-sm text-[#60766e]">Chaque sommet représente une commune · hauteur proportionnelle au nombre d’abonnés</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => adjustZoomRef.current(false)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#d7e4df] text-[#244d42] transition-colors hover:bg-[#eff6f2]"
            title="Zoomer en arrière"
            aria-label="Zoomer en arrière"
          >
            <ZoomOut size={16} />
          </button>
          <button
            type="button"
            onClick={() => adjustZoomRef.current(true)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#d7e4df] text-[#244d42] transition-colors hover:bg-[#eff6f2]"
            title="Zoomer en avant"
            aria-label="Zoomer en avant"
          >
            <ZoomIn size={16} />
          </button>
          <button
            type="button"
            onClick={() => setIsPlaying((playing) => !playing)}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#d7e4df] px-3 text-sm font-bold text-[#244d42] transition-colors hover:bg-[#eff6f2]"
            title={isPlaying ? "Mettre la rotation automatique en pause" : "Activer la rotation automatique"}
            aria-label={isPlaying ? "Mettre la rotation automatique en pause" : "Activer la rotation automatique"}
          >
            {isPlaying ? <Pause size={15} /> : <Play size={15} />}
            {isPlaying ? "Pause" : "Reprendre"}
          </button>
          <button
            type="button"
            onClick={() => resetViewRef.current()}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#d7e4df] text-[#244d42] transition-colors hover:bg-[#eff6f2]"
            title="Réinitialiser la vue"
            aria-label="Réinitialiser la vue"
          >
            <Crosshair size={16} />
          </button>
        </div>
      </div>

      {points.length === 0 ? (
        <p className="p-8 text-center text-sm font-medium text-[#667085]">Aucune donnée disponible par commune.</p>
      ) : webglUnavailable ? (
        <p role="alert" className="p-8 text-center text-sm font-medium text-[#667085]">La visualisation 3D nécessite un navigateur compatible WebGL.</p>
      ) : (
        <div className="relative h-[360px] overflow-hidden bg-[#b9d7cf] sm:h-[460px]">
          <div ref={hostRef} className="absolute inset-0" />
          {!sceneReady && <div className="absolute inset-0 animate-pulse bg-[#b9d7cf]" />}
          <div className="pointer-events-none absolute left-4 top-4 rounded-lg border border-white/50 bg-[#173a32]/80 px-3 py-2 text-white shadow-lg backdrop-blur-sm sm:left-6 sm:top-6">
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#b8d7c9]">Cap · survol</p>
            <p className="mt-0.5 text-sm font-bold">{hoveredPoint?.name ?? "Vue d’ensemble"}</p>
          </div>
          <div className="pointer-events-none absolute right-4 top-4 rounded-lg border border-white/50 bg-[#173a32]/80 px-3 py-2 text-right text-white shadow-lg backdrop-blur-sm sm:right-6 sm:top-6">
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#b8d7c9]">Communes</p>
            <p className="mt-0.5 text-sm font-bold">{points.length.toLocaleString("fr-FR")}</p>
          </div>
          {hoveredPoint && (
            <div className="pointer-events-none absolute bottom-4 left-4 max-w-[calc(100%-2rem)] rounded-lg border border-white/60 bg-white/95 px-4 py-3 text-[#163b32] shadow-xl sm:bottom-6 sm:left-6">
              <p className="truncate text-sm font-black">{hoveredPoint.name}</p>
              <p className="mt-1 text-xs font-medium text-[#60766e]">
                <strong className="text-[#176b58]">{hoveredPoint.total.toLocaleString("fr-FR")}</strong> abonnés
                <span className="mx-1.5">·</span>{hoveredPoint.active.toLocaleString("fr-FR")} actifs
                <span className="mx-1.5">·</span>{hoveredPoint.forfait.toLocaleString("fr-FR")} forfaits
                <span className="mx-1.5">·</span>{hoveredPoint.resigned.toLocaleString("fr-FR")} résiliés
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}