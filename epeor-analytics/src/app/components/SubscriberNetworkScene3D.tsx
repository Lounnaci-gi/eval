"use client";

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type NetworkSubscriber = {
  numab: string;
  name: string;
  raison_sociale: string;
  commune: string;
  codcom: string;
  typabon: string;
  type_abonne: string;
  adresse: string;
  bloc: string;
  ndom: string;
  tournee: string;
  etatcpt: string;
  etat_label: string;
  statut_compteur: string;
  statut_facture: string;
  date_derniere_facture: string;
  date_dernier_paiement: string;
};

type SceneLevel = "commune" | "tournee" | "type_abonne" | "abonne";
type MeterStatus = "en_marche" | "a_arret" | "resilie" | "non_branche" | "inconnu";
type InvoiceStatus = "payee" | "impayee" | "inconnue";
type Point3 = [number, number, number];
type HierarchyNode = {
  id: string;
  label: string;
  level: Exclude<SceneLevel, "abonne">;
  parentId: string | null;
  position: Point3;
  members: NetworkSubscriber[];
};
type SceneGraph = {
  communes: HierarchyNode[];
  tournees: HierarchyNode[];
  types: HierarchyNode[];
  nodesById: Map<string, HierarchyNode>;
  communeCloudPositions: Map<string, Point3>;
  tourneeCloudPositions: Map<string, Point3>;
  typeCloudPositions: Map<string, Point3>;
  subscriberPositions: Map<string, Point3>;
  radius: number;
};
type SelectedEntity = HierarchyNode | NetworkSubscriber;
type ColorMode = "compteur" | "facture";
type DisplayDatum = { subscriber: NetworkSubscriber; entity: HierarchyNode | NetworkSubscriber };

const ZOOM_LEVEL_THRESHOLDS = {
  tournee: 0.85,
  type_abonne: 2.2,
  abonne: 3.45,
};
const LEVEL_LABELS: Record<SceneLevel, string> = {
  commune: "Communes",
  tournee: "Tournées",
  type_abonne: "Types d’abonnés",
  abonne: "Abonnés",
};
const METER_COLORS: Record<MeterStatus, THREE.Color> = {
  en_marche: new THREE.Color("#4ade80"),
  a_arret: new THREE.Color("#fbbf24"),
  resilie: new THREE.Color("#fb7185"),
  non_branche: new THREE.Color("#94a3b8"),
  inconnu: new THREE.Color("#cbd5e1"),
};
const INVOICE_COLORS: Record<InvoiceStatus, THREE.Color> = {
  payee: new THREE.Color("#4ade80"),
  impayee: new THREE.Color("#fb7185"),
  inconnue: new THREE.Color("#94a3b8"),
};
const TYPE_PALETTE = ["#a78bfa", "#38bdf8", "#2dd4bf", "#f472b6", "#fbbf24", "#60a5fa"];
const STATUS_LABELS: Record<MeterStatus, string> = {
  en_marche: "En marche",
  a_arret: "À l’arrêt",
  resilie: "Résilié",
  non_branche: "Non branché",
  inconnu: "Inconnu",
};

function hashString(value: string) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function random01(seed: number) {
  const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
  return value - Math.floor(value);
}

function gaussian(seed: number) {
  const first = Math.max(0.0001, random01(seed));
  const second = random01(seed + 1);
  return Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * second);
}

function normalized(value: string | undefined) {
  return String(value ?? "").trim().toLocaleLowerCase("fr") || "inconnu";
}

function normalizedSearch(value: string | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("fr");
}

function meterStatus(subscriber: NetworkSubscriber): MeterStatus {
  if (subscriber.statut_compteur in METER_COLORS) return subscriber.statut_compteur as MeterStatus;
  if (subscriber.etatcpt === "20") return "en_marche";
  if (subscriber.etatcpt === "40") return "resilie";
  if (subscriber.etatcpt === "41") return "non_branche";
  return subscriber.etatcpt ? "a_arret" : "inconnu";
}

function invoiceStatus(subscriber: NetworkSubscriber): InvoiceStatus {
  if (subscriber.statut_facture === "payee" || subscriber.statut_facture === "payée") return "payee";
  if (subscriber.statut_facture === "impayee" || subscriber.statut_facture === "impayée") return "impayee";
  return "inconnue";
}

function groupColor(label: string) {
  const palette = TYPE_PALETTE;
  return new THREE.Color(palette[hashString(normalized(label)) % palette.length]);
}

function jittered(center: Point3, seed: number, spread: number): Point3 {
  return [
    center[0] + gaussian(seed * 3 + 1) * spread,
    center[1] + gaussian(seed * 3 + 2) * spread,
    center[2] + gaussian(seed * 3 + 3) * spread,
  ];
}

function spherePoint(seed: number, radius: number): Point3 {
  const z = random01(seed + 2) * 2 - 1;
  const angle = random01(seed + 3) * Math.PI * 2;
  const distance = radius * Math.cbrt(random01(seed + 4));
  const ring = Math.sqrt(1 - z * z);
  return [Math.cos(angle) * ring * distance, z * distance, Math.sin(angle) * ring * distance];
}

function createSceneGraph(subscribers: NetworkSubscriber[]): SceneGraph {
  const communes = new Map<string, HierarchyNode>();
  const tournees = new Map<string, HierarchyNode>();
  const types = new Map<string, HierarchyNode>();

  for (const subscriber of subscribers) {
    const communeKey = normalized(subscriber.codcom) !== "inconnu"
      ? normalized(subscriber.codcom)
      : normalized(subscriber.commune);
    const communeId = `commune:${communeKey}`;
    const commune = communes.get(communeId) ?? {
      id: communeId,
      label: subscriber.commune || subscriber.codcom || "Commune inconnue",
      level: "commune" as const,
      parentId: null,
      position: [0, 0, 0] as Point3,
      members: [],
    };
    commune.members.push(subscriber);
    communes.set(communeId, commune);

    const tourneeKey = normalized(subscriber.tournee);
    const tourneeId = `tournee:${communeKey}:${tourneeKey}`;
    const tournee = tournees.get(tourneeId) ?? {
      id: tourneeId,
      label: subscriber.tournee || "Sans tournée",
      level: "tournee" as const,
      parentId: communeId,
      position: [0, 0, 0] as Point3,
      members: [],
    };
    tournee.members.push(subscriber);
    tournees.set(tourneeId, tournee);

    const typeLabel = subscriber.type_abonne || subscriber.typabon || "Type inconnu";
    const typeKey = normalized(subscriber.typabon || typeLabel);
    const typeId = `type:${tourneeId}:${typeKey}`;
    const type = types.get(typeId) ?? {
      id: typeId,
      label: typeLabel,
      level: "type_abonne" as const,
      parentId: tourneeId,
      position: [0, 0, 0] as Point3,
      members: [],
    };
    type.members.push(subscriber);
    types.set(typeId, type);
  }

  const communeNodes = [...communes.values()];
  const clusterRadius = Math.max(130, Math.sqrt(communeNodes.length) * 43);
  communeNodes.forEach((node) => {
    const seed = hashString(node.id);
    const point = spherePoint(seed, clusterRadius * 0.82);
    node.position = point;
  });

  const tourneeNodes = [...tournees.values()];
  for (const commune of communeNodes) {
    const children = tourneeNodes.filter((node) => node.parentId === commune.id);
    children.forEach((node, index) => {
      const direction = spherePoint(hashString(node.id), 1);
      const orbit = 26 + Math.sqrt(index + 1) * 5.2;
      node.position = [
        commune.position[0] + direction[0] * orbit,
        commune.position[1] + direction[1] * orbit,
        commune.position[2] + direction[2] * orbit,
      ];
    });
  }

  const typeNodes = [...types.values()];
  for (const tournee of tourneeNodes) {
    const children = typeNodes.filter((node) => node.parentId === tournee.id);
    children.forEach((node, index) => {
      const direction = spherePoint(hashString(node.id), 1);
      const orbit = 9 + index * 3;
      node.position = [
        tournee.position[0] + direction[0] * orbit,
        tournee.position[1] + direction[1] * orbit,
        tournee.position[2] + direction[2] * orbit,
      ];
    });
  }

  const nodesById = new Map([...communeNodes, ...tourneeNodes, ...typeNodes].map((node) => [node.id, node]));
  const communeCloudPositions = new Map<string, Point3>();
  const tourneeCloudPositions = new Map<string, Point3>();
  const typeCloudPositions = new Map<string, Point3>();
  const subscriberPositions = new Map<string, Point3>();
  for (const commune of communeNodes) {
    const spread = Math.max(3, Math.min(42, 4 + Math.sqrt(commune.members.length) * 0.34));
    commune.members.forEach((subscriber) => {
      communeCloudPositions.set(subscriber.numab, jittered(commune.position, hashString(subscriber.numab), spread));
    });
  }
  for (const tournee of tourneeNodes) {
    const spread = Math.max(1.7, Math.min(14, 1.8 + Math.sqrt(tournee.members.length) * 0.24));
    tournee.members.forEach((subscriber) => {
      tourneeCloudPositions.set(subscriber.numab, jittered(tournee.position, hashString(subscriber.numab), spread));
    });
  }
  for (const type of typeNodes) {
    const spread = Math.max(1, Math.min(7, 0.9 + Math.sqrt(type.members.length) * 0.17));
    type.members.forEach((subscriber) => {
      const seed = hashString(subscriber.numab);
      typeCloudPositions.set(subscriber.numab, jittered(type.position, seed, spread));
      subscriberPositions.set(subscriber.numab, jittered(type.position, seed + 41, Math.max(0.55, Math.min(3.2, Math.sqrt(type.members.length) * 0.08))));
    });
  }

  return {
    communes: communeNodes,
    tournees: tourneeNodes,
    types: typeNodes,
    nodesById,
    communeCloudPositions,
    tourneeCloudPositions,
    typeCloudPositions,
    subscriberPositions,
    radius: clusterRadius,
  };
}

function displayLabel(node: HierarchyNode) {
  return `${node.label}  ·  ${node.members.length.toLocaleString("fr-FR")}`;
}

function createLabelSprite(node: HierarchyNode) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 96;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Impossible de créer les étiquettes du graphe 3D.");
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.font = "600 30px Segoe UI, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "rgba(2, 6, 23, 0.78)";
  context.beginPath();
  context.roundRect(8, 8, canvas.width - 16, canvas.height - 16, 24);
  context.fill();
  context.strokeStyle = "rgba(125, 211, 252, 0.55)";
  context.lineWidth = 2;
  context.stroke();
  context.fillStyle = "#e0f2fe";
  context.fillText(displayLabel(node), canvas.width / 2, canvas.height / 2, canvas.width - 32);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    opacity: 1,
  });
  const sprite = new THREE.Sprite(material);
  const scale = node.level === "commune" ? 22 : node.level === "tournee" ? 13 : 9;
  sprite.scale.set(scale * (canvas.width / canvas.height), scale, 1);
  sprite.position.set(node.position[0], node.position[1] + scale * 0.65, node.position[2]);
  sprite.renderOrder = 5;
  return sprite;
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    if (child instanceof THREE.Points) {
      child.geometry.dispose();
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => {
        if (material instanceof THREE.PointsMaterial) material.map?.dispose();
        material.dispose();
      });
    } else if (child instanceof THREE.Sprite) {
      child.material.map?.dispose();
      child.material.dispose();
    }
  });
}

function buildVisual(
  graph: SceneGraph,
  level: SceneLevel,
  focus: HierarchyNode | null,
  colorMode: ColorMode,
) {
  let records: DisplayDatum[] = [];
  let labels: HierarchyNode[] = [];
  let getPosition: (datum: DisplayDatum) => Point3;

  if (level === "commune") {
    records = graph.communes.flatMap((commune) => commune.members.map((subscriber) => ({ subscriber, entity: commune })));
    labels = graph.communes;
    getPosition = ({ subscriber }) => graph.communeCloudPositions.get(subscriber.numab) ?? [0, 0, 0];
  } else if (level === "tournee") {
    if (!focus) return new THREE.Group();
    labels = graph.tournees.filter((node) => node.parentId === focus.id);
    records = focus.members.map((subscriber) => ({
      subscriber,
      entity: graph.nodesById.get(`tournee:${normalized(subscriber.codcom) !== "inconnu" ? normalized(subscriber.codcom) : normalized(subscriber.commune)}:${normalized(subscriber.tournee)}`) ?? focus,
    }));
    getPosition = ({ subscriber }) => graph.tourneeCloudPositions.get(subscriber.numab) ?? [0, 0, 0];
  } else if (level === "type_abonne") {
    if (!focus) return new THREE.Group();
    labels = graph.types.filter((node) => node.parentId === focus.id);
    records = focus.members.map((subscriber) => {
      const communeKey = normalized(subscriber.codcom) !== "inconnu" ? normalized(subscriber.codcom) : normalized(subscriber.commune);
      const tourneeId = `tournee:${communeKey}:${normalized(subscriber.tournee)}`;
      const typeId = `type:${tourneeId}:${normalized(subscriber.typabon || subscriber.type_abonne || "Type inconnu")}`;
      return { subscriber, entity: graph.nodesById.get(typeId) ?? focus };
    });
    getPosition = ({ subscriber }) => graph.typeCloudPositions.get(subscriber.numab) ?? [0, 0, 0];
  } else {
    if (!focus) return new THREE.Group();
    records = focus.members.map((subscriber) => ({ subscriber, entity: subscriber }));
    getPosition = ({ subscriber }) => graph.subscriberPositions.get(subscriber.numab) ?? focus.position;
  }

  const positions = new Float32Array(records.length * 3);
  const colors = new Float32Array(records.length * 3);
  const pointRecords: DisplayDatum[] = new Array(records.length);
  records.forEach((datum, index) => {
    const position = getPosition(datum);
    positions[index * 3] = position[0];
    positions[index * 3 + 1] = position[1];
    positions[index * 3 + 2] = position[2];
    let color: THREE.Color;
    if (level === "abonne") {
      color = colorMode === "compteur" ? METER_COLORS[meterStatus(datum.subscriber)] : INVOICE_COLORS[invoiceStatus(datum.subscriber)];
    } else if (level === "type_abonne") {
      color = groupColor((datum.entity as HierarchyNode).label);
    } else if (level === "tournee") {
      color = new THREE.Color("#2dd4bf");
    } else {
      color = new THREE.Color("#7dd3fc");
    }
    colors[index * 3] = color.r;
    colors[index * 3 + 1] = color.g;
    colors[index * 3 + 2] = color.b;
    pointRecords[index] = datum;
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();

  const group = new THREE.Group();
  const material = new THREE.PointsMaterial({
    size: level === "abonne" ? 3.4 : level === "commune" ? 2.4 : 3,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geometry, material);
  points.userData.pointRecords = pointRecords;
  points.userData.level = level;
  points.frustumCulled = false;
  group.add(points);

  const glowMaterial = new THREE.PointsMaterial({
    size: level === "commune" ? 13 : 8,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const glow = new THREE.Points(geometry, glowMaterial);
  glow.userData.isGlow = true;
  glow.frustumCulled = false;
  group.add(glow);

  const uniqueLabels = new Set<string>();
  for (const node of labels) {
    if (uniqueLabels.has(node.id)) continue;
    uniqueLabels.add(node.id);
    group.add(createLabelSprite(node));
  }
  group.userData.pointsMaterial = material;
  group.userData.glowMaterial = glowMaterial;
  group.userData.level = level;
  return group;
}

function parentNode(graph: SceneGraph, node: HierarchyNode) {
  return node.parentId ? graph.nodesById.get(node.parentId) ?? null : null;
}

function statusSummary(members: NetworkSubscriber[]) {
  const meter: Record<MeterStatus, number> = {
    en_marche: 0,
    a_arret: 0,
    resilie: 0,
    non_branche: 0,
    inconnu: 0,
  };
  let paid = 0;
  let unpaid = 0;
  let unknownInvoice = 0;
  for (const subscriber of members) {
    meter[meterStatus(subscriber)] += 1;
    const invoice = invoiceStatus(subscriber);
    if (invoice === "payee") paid += 1;
    else if (invoice === "impayee") unpaid += 1;
    else unknownInvoice += 1;
  }
  return { meter, paid, unpaid, unknownInvoice };
}

function DetailCard({ entity }: { entity: SelectedEntity | null }) {
  if (!entity) {
    return (
      <div className="rounded-xl border border-sky-300/15 bg-slate-950/65 p-4 text-sm text-slate-400">
        Sélectionnez une particule pour afficher ses informations.
      </div>
    );
  }
  if ("numab" in entity) {
    const subscriber = entity;
    return (
      <div className="space-y-3 rounded-xl border border-sky-300/20 bg-slate-950/75 p-4 text-sm shadow-xl shadow-sky-950/20 backdrop-blur-md">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-sky-300">Abonné</p>
          <h4 className="mt-1 break-words font-bold text-slate-100">{subscriber.raison_sociale || subscriber.name}</h4>
          <p className="mt-1 text-xs text-slate-400">N° {subscriber.numab}</p>
        </div>
        <dl className="space-y-2 border-t border-white/10 pt-3 text-xs">
          <DetailRow label="Commune" value={subscriber.commune} />
          <DetailRow label="Tournée" value={subscriber.tournee || "Sans tournée"} />
          <DetailRow label="Type" value={subscriber.type_abonne || subscriber.typabon || "Inconnu"} />
          <DetailRow label="Adresse" value={`${subscriber.adresse || ""} ${subscriber.ndom || ""} ${subscriber.bloc || ""}`.trim() || "—"} />
          <DetailRow label="Compteur" value={subscriber.etat_label || STATUS_LABELS[meterStatus(subscriber)]} />
          <DetailRow label="Facture" value={invoiceStatus(subscriber) === "payee" ? "Payée" : invoiceStatus(subscriber) === "impayee" ? "Impayée" : "Inconnue"} />
          <DetailRow label="Dernière facture" value={subscriber.date_derniere_facture || "—"} />
          <DetailRow label="Dernier paiement" value={subscriber.date_dernier_paiement || "—"} />
        </dl>
      </div>
    );
  }
  const summary = statusSummary(entity.members);
  return (
    <div className="space-y-3 rounded-xl border border-sky-300/20 bg-slate-950/75 p-4 text-sm shadow-xl shadow-sky-950/20 backdrop-blur-md">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-sky-300">
          {LEVEL_LABELS[entity.level]}
        </p>
        <h4 className="mt-1 break-words font-bold text-slate-100">{entity.label}</h4>
        <p className="mt-1 text-xs text-slate-400">
          {entity.members.length.toLocaleString("fr-FR")} abonnés
        </p>
      </div>
      <div className="space-y-2 border-t border-white/10 pt-3 text-xs">
        {Object.entries(summary.meter).filter(([, count]) => count > 0).map(([status, count]) => (
          <DetailRow key={status} label={STATUS_LABELS[status as MeterStatus]} value={count.toLocaleString("fr-FR")} />
        ))}
        <DetailRow label="Factures payées" value={summary.paid.toLocaleString("fr-FR")} />
        <DetailRow label="Factures impayées" value={summary.unpaid.toLocaleString("fr-FR")} />
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-slate-400">{label}</dt>
      <dd className="text-right font-medium text-slate-200">{value}</dd>
    </div>
  );
}

export function SubscriberNetworkScene3D({ subscribers }: { subscribers: NetworkSubscriber[] }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const rendererCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const navigateRef = useRef<(level: SceneLevel, focus?: HierarchyNode | null) => void>(() => {});
  const searchRef = useRef<(query: string) => void>(() => {});
  const [activeLevel, setActiveLevel] = useState<SceneLevel>("commune");
  const [selectedEntity, setSelectedEntity] = useState<SelectedEntity | null>(null);
  const [selectedPath, setSelectedPath] = useState<HierarchyNode[]>([]);
  const [hoverLabel, setHoverLabel] = useState("");
  const [colorMode, setColorMode] = useState<ColorMode>("compteur");
  const [searchText, setSearchText] = useState("");
  const [searchError, setSearchError] = useState("");
  const [webglUnavailable, setWebglUnavailable] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const graph = useMemo(() => createSceneGraph(subscribers), [subscribers]);
  const colorModeRef = useRef<ColorMode>(colorMode);
  const viewStateRef = useRef({ activeLevel, selectedPath });

  useEffect(() => {
    viewStateRef.current = { activeLevel, selectedPath };
  }, [activeLevel, selectedPath]);

  useEffect(() => {
    colorModeRef.current = colorMode;
    const viewState = viewStateRef.current;
    if (viewState.activeLevel !== "abonne") return;
    const selectedType = viewState.selectedPath.at(-1);
    if (selectedType) navigateRef.current("abonne", selectedType);
  }, [colorMode]);

  const setPathFor = useCallback((level: SceneLevel, focus: HierarchyNode | null) => {
    setActiveLevel(level);
    if (level === "commune" || !focus) {
      setSelectedPath([]);
      return;
    }
    const path: HierarchyNode[] = [];
    let current: HierarchyNode | null = focus;
    while (current) {
      path.unshift(current);
      current = parentNode(graph, current);
    }
    setSelectedPath(path);
  }, [graph]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    setSceneReady(false);
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    } catch {
      setWebglUnavailable(true);
      return;
    }
    setWebglUnavailable(false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    renderer.domElement.className = "absolute inset-0 h-full w-full touch-none";
    renderer.domElement.setAttribute("aria-label", "Amas stellaire 3D des abonnés");
    host.appendChild(renderer.domElement);
    rendererCanvasRef.current = renderer.domElement;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#030712");
    scene.fog = new THREE.FogExp2("#030712", 0.00075);
    const camera = new THREE.PerspectiveCamera(52, 1, 0.1, graph.radius * 16);
    const root = new THREE.Group();
    scene.add(root);
    scene.add(new THREE.HemisphereLight("#bfdbfe", "#1e1b4b", 1.25));
    const coreLight = new THREE.PointLight("#7dd3fc", 2.8, graph.radius * 5);
    coreLight.position.set(0, 0, 0);
    scene.add(coreLight);

    const starCount = Math.max(1500, Math.min(4200, Math.floor(subscribers.length / 8)));
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);
    for (let index = 0; index < starCount; index += 1) {
      const position = spherePoint(index + 17001, graph.radius * 5.8);
      starPositions.set(position, index * 3);
      const brightness = 0.45 + random01(index + 21001) * 0.55;
      const cool = random01(index + 25001) > 0.83;
      const color = cool ? [0.58, 0.78, 1] : [brightness, brightness * 0.94, brightness * 0.82];
      starColors.set(color, index * 3);
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    starGeometry.setAttribute("color", new THREE.BufferAttribute(starColors, 3));
    const starMaterial = new THREE.PointsMaterial({
      size: 1.25,
      sizeAttenuation: false,
      vertexColors: true,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
    });
    const starfield = new THREE.Points(starGeometry, starMaterial);
    scene.add(starfield);

    const initialDistance = graph.radius * 3.7;
    camera.position.set(0, graph.radius * 0.55, initialDistance);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.075;
    controls.enablePan = true;
    controls.screenSpacePanning = true;
    controls.zoomToCursor = true;
    controls.minDistance = graph.radius * 0.12;
    controls.maxDistance = graph.radius * 7;
    controls.minPolarAngle = 0.04;
    controls.maxPolarAngle = Math.PI - 0.04;
    controls.target.set(0, 0, 0);
    controls.update();

    const transitions = new Map<THREE.Group, { from: number; to: number; started: number; duration: number }>();
    let activeVisual: THREE.Group | null = null;
    let currentLevel: SceneLevel = "commune";
    let focusedCommune: HierarchyNode | null = null;
    let focusedTournee: HierarchyNode | null = null;
    let focusedType: HierarchyNode | null = null;
    let selectedRef: SelectedEntity | null = null;
    let lastPointerDown: { x: number; y: number } | null = null;
    let pointerDragged = false;
    let cameraAnimating = false;
    let frameId = 0;
    let lastHudUpdate = 0;

    const getLevelDistance = (level: SceneLevel) => (
      level === "commune" ? initialDistance
        : level === "tournee" ? graph.radius * 1.75
          : level === "type_abonne" ? graph.radius * 0.78
            : graph.radius * 0.31
    );

    const nearestNode = (nodes: HierarchyNode[], position: THREE.Vector3) => {
      let nearest: HierarchyNode | null = null;
      let nearestDistance = Number.POSITIVE_INFINITY;
      for (const node of nodes) {
        const distance = position.distanceTo(new THREE.Vector3(...node.position));
        if (distance < nearestDistance) {
          nearest = node;
          nearestDistance = distance;
        }
      }
      return nearest;
    };

    const transitionVisual = (level: SceneLevel, focus: HierarchyNode | null, now = performance.now()) => {
      if (activeVisual) {
        const currentOpacity = activeVisual.userData.opacity as number;
        transitions.set(activeVisual, { from: currentOpacity, to: 0, started: now, duration: 520 });
      }
      const visual = buildVisual(graph, level, focus, colorModeRef.current);
      visual.userData.opacity = 0;
      root.add(visual);
      transitions.set(visual, { from: 0, to: 1, started: now, duration: 650 });
      activeVisual = visual;
      currentLevel = level;
      setPathFor(level, focus);
      setSelectedEntity(focus);
      selectedRef = focus;
      return visual;
    };

    const navigateTo = (level: SceneLevel, focus?: HierarchyNode | null) => {
      let targetNode = focus ?? null;
      if (level === "commune") {
        targetNode = null;
        focusedCommune = null;
        focusedTournee = null;
        focusedType = null;
      } else if (level === "tournee") {
        targetNode = focus ?? focusedCommune;
        focusedCommune = targetNode;
        focusedTournee = null;
        focusedType = null;
      } else if (level === "type_abonne") {
        targetNode = focus ?? focusedTournee;
        focusedTournee = targetNode;
        focusedCommune = targetNode ? parentNode(graph, targetNode) : focusedCommune;
        focusedType = null;
      } else {
        targetNode = focus ?? focusedType;
        focusedType = targetNode;
        focusedTournee = targetNode ? parentNode(graph, targetNode) : focusedTournee;
        focusedCommune = focusedTournee ? parentNode(graph, focusedTournee) : focusedCommune;
      }
      if (!targetNode && level !== "commune") return;
      const target = targetNode ? new THREE.Vector3(...targetNode.position) : new THREE.Vector3(0, 0, 0);
      const direction = camera.position.clone().sub(controls.target).normalize();
      const distance = getLevelDistance(level);
      const destinationPosition = target.clone().add(direction.multiplyScalar(distance));
      const fromPosition = camera.position.clone();
      const fromTarget = controls.target.clone();
      const started = performance.now();
      const duration = 950;
      cameraAnimating = true;
      const tween = () => {
        const raw = Math.min(1, (performance.now() - started) / duration);
        const eased = raw * raw * (3 - 2 * raw);
        camera.position.lerpVectors(fromPosition, destinationPosition, eased);
        controls.target.lerpVectors(fromTarget, target, eased);
        controls.update();
        if (raw < 1) requestAnimationFrame(tween);
        else cameraAnimating = false;
      };
      requestAnimationFrame(tween);
      const visual = transitionVisual(level, targetNode);
      visual.userData.key = `${level}:${targetNode?.id ?? "root"}`;
    };
    navigateRef.current = navigateTo;
    searchRef.current = (rawQuery) => {
      const query = normalizedSearch(rawQuery);
      if (!query) {
        setSearchError("Saisissez une commune, une tournée ou une raison sociale.");
        return;
      }

      const commune = graph.communes.find((node) => normalizedSearch(node.label).includes(query));
      if (commune) {
        setSearchError("");
        navigateTo("tournee", commune);
        return;
      }
      const tournee = graph.tournees.find((node) => normalizedSearch(node.label).includes(query));
      if (tournee) {
        setSearchError("");
        navigateTo("type_abonne", tournee);
        return;
      }
      const type = graph.types.find((node) => normalizedSearch(node.label).includes(query));
      if (type) {
        setSearchError("");
        navigateTo("abonne", type);
        return;
      }

      const subscriber = subscribers.find((item) => (
        normalizedSearch(item.raison_sociale || item.name).includes(query)
        || normalizedSearch(item.numab).includes(query)
      ));
      if (subscriber) {
        const communeKey = normalized(subscriber.codcom) !== "inconnu"
          ? normalized(subscriber.codcom)
          : normalized(subscriber.commune);
        const tourneeId = `tournee:${communeKey}:${normalized(subscriber.tournee)}`;
        const typeId = `type:${tourneeId}:${normalized(subscriber.typabon || subscriber.type_abonne || "Type inconnu")}`;
        const typeNode = graph.nodesById.get(typeId);
        if (typeNode) {
          setSearchError("");
          navigateTo("abonne", typeNode);
          selectedRef = subscriber;
          setSelectedEntity(subscriber);
          return;
        }
      }

      setSearchError("Aucun résultat trouvé.");
    };

    const setHierarchyFromCamera = (now: number) => {
      const distance = camera.position.distanceTo(controls.target);
      const normalizedZoom = Math.log2(initialDistance / Math.max(distance, 0.01));
      let nextLevel: SceneLevel = normalizedZoom >= ZOOM_LEVEL_THRESHOLDS.abonne
        ? "abonne"
        : normalizedZoom >= ZOOM_LEVEL_THRESHOLDS.type_abonne
          ? "type_abonne"
          : normalizedZoom >= ZOOM_LEVEL_THRESHOLDS.tournee
            ? "tournee"
            : "commune";

      const selectedPosition = controls.target;
      if (nextLevel === "commune") {
        focusedCommune = null;
        focusedTournee = null;
        focusedType = null;
      } else if (nextLevel === "tournee") {
        focusedCommune = nearestNode(graph.communes, selectedPosition);
        focusedTournee = null;
        focusedType = null;
      } else if (nextLevel === "type_abonne") {
        if (!focusedCommune) focusedCommune = nearestNode(graph.communes, selectedPosition);
        const childTournees = graph.tournees.filter((node) => node.parentId === focusedCommune?.id);
        focusedTournee = nearestNode(childTournees, selectedPosition);
        focusedType = null;
      } else {
        if (!focusedCommune) focusedCommune = nearestNode(graph.communes, selectedPosition);
        if (!focusedTournee) {
          focusedTournee = nearestNode(
            graph.tournees.filter((node) => node.parentId === focusedCommune?.id),
            selectedPosition,
          );
        }
        focusedType = nearestNode(
          graph.types.filter((node) => node.parentId === focusedTournee?.id),
          selectedPosition,
        );
      }

      const focus = nextLevel === "tournee"
        ? focusedCommune
        : nextLevel === "type_abonne"
          ? focusedTournee
          : nextLevel === "abonne"
            ? focusedType
            : null;
      const key = `${nextLevel}:${focus?.id ?? "root"}`;
      if (key !== activeVisual?.userData.key) {
        if (activeVisual) activeVisual.userData.opacity = activeVisual.userData.opacity ?? 1;
        const visual = transitionVisual(nextLevel, focus, now);
        if (focus?.id !== (selectedRef && "id" in selectedRef ? selectedRef.id : null)) {
          selectedRef = focus;
          setSelectedEntity(focus);
        }
        visual.userData.key = key;
      }
    };

    const raycaster = new THREE.Raycaster();
    raycaster.params.Points.threshold = graph.radius * 0.012;
    const pointer = new THREE.Vector2();
    const pick = (event: Pick<PointerEvent, "clientX" | "clientY">) => {
      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
      );
      raycaster.params.Points.threshold = Math.max(0.6, camera.position.distanceTo(controls.target) * 0.007);
      raycaster.setFromCamera(pointer, camera);
      const pointObjects = activeVisual?.children.filter((child) => child instanceof THREE.Points && !child.userData.isGlow) ?? [];
      const hit = raycaster.intersectObjects(pointObjects, false)[0];
      if (!hit || hit.index == null) return null;
      const pointRecords = (hit.object as THREE.Points).userData.pointRecords as DisplayDatum[];
      return pointRecords[hit.index] ?? null;
    };

    const onPointerMove = (event: PointerEvent) => {
      if (lastPointerDown) {
        const dx = event.clientX - lastPointerDown.x;
        const dy = event.clientY - lastPointerDown.y;
        if (dx * dx + dy * dy > 25) pointerDragged = true;
      }
      const hit = pick(event);
      if (!hit) {
        setHoverLabel("");
        return;
      }
      const label = "label" in hit.entity
        ? hit.entity.label
        : hit.entity.raison_sociale || hit.entity.name;
      const count = "members" in hit.entity ? hit.entity.members.length : 1;
      setHoverLabel(`${label} · ${count.toLocaleString("fr-FR")} abonné${count > 1 ? "s" : ""}`);
    };
    const onPointerDown = (event: PointerEvent) => {
      lastPointerDown = { x: event.clientX, y: event.clientY };
      pointerDragged = false;
    };
    const onPointerUp = () => {
      lastPointerDown = null;
    };
    const onClick = (event: MouseEvent) => {
      if (pointerDragged) {
        pointerDragged = false;
        return;
      }
      const hit = pick(event);
      if (!hit) return;
      selectedRef = hit.entity;
      setSelectedEntity(hit.entity);
      if (currentLevel === "commune" && "id" in hit.entity) {
        focusedCommune = hit.entity;
        navigateTo("tournee", hit.entity);
      } else if (currentLevel === "tournee" && "id" in hit.entity) {
        focusedTournee = hit.entity;
        navigateTo("type_abonne", hit.entity);
      } else if (currentLevel === "type_abonne" && "id" in hit.entity) {
        focusedType = hit.entity;
        navigateTo("abonne", hit.entity);
      }
    };
    const onControlsChange = () => {
      if (!cameraAnimating) setHierarchyFromCamera(performance.now());
    };
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("click", onClick);
    controls.addEventListener("change", onControlsChange);

    const initialVisual = transitionVisual("commune", null);
    initialVisual.userData.key = "commune:root";
    const resizeObserver = new ResizeObserver(() => {
      const { width, height } = host.getBoundingClientRect();
      if (!width || !height) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    });
    resizeObserver.observe(host);

    let previousTime = performance.now();
    const animate = (time: number) => {
      frameId = window.requestAnimationFrame(animate);
      const delta = Math.min(0.05, (time - previousTime) / 1000);
      previousTime = time;
      controls.update();
      root.rotation.y += delta * 0.012;
      starfield.rotation.y -= delta * 0.0015;

      for (const [visual, transition] of transitions) {
        const progress = Math.min(1, (time - transition.started) / transition.duration);
        const eased = progress * progress * (3 - 2 * progress);
        const opacity = transition.from + (transition.to - transition.from) * eased;
        visual.userData.opacity = opacity;
        const material = visual.userData.pointsMaterial as THREE.PointsMaterial;
        const glowMaterial = visual.userData.glowMaterial as THREE.PointsMaterial;
        material.opacity = opacity;
        glowMaterial.opacity = opacity * 0.09;
        visual.children.forEach((child) => {
          if (child instanceof THREE.Sprite) child.material.opacity = opacity;
        });
        if (progress === 1) {
          transitions.delete(visual);
          if (transition.to === 0) {
            root.remove(visual);
            disposeObject(visual);
          }
        }
      }
      if (time - lastHudUpdate > 120) {
        lastHudUpdate = time;
        setSceneReady(true);
      }
      renderer.render(scene, camera);
    };
    frameId = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      controls.removeEventListener("change", onControlsChange);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("click", onClick);
      controls.dispose();
      for (const child of [...root.children]) {
        root.remove(child);
        disposeObject(child);
      }
      starGeometry.dispose();
      starMaterial.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      rendererCanvasRef.current = null;
      navigateRef.current = () => {};
      searchRef.current = () => {};
    };
  }, [graph, setPathFor, subscribers]);

  const breadcrumbs = selectedPath;
  const totalCounts = useMemo(() => ({
    communes: graph.communes.length,
    tournees: graph.tournees.length,
    types: graph.types.length,
    subscribers: subscribers.length,
  }), [graph, subscribers.length]);

  const changeColorMode = (mode: ColorMode) => {
    colorModeRef.current = mode;
    setColorMode(mode);
  };

  return (
    <div className="relative h-[70vh] min-h-[520px] overflow-hidden rounded-xl border border-sky-300/20 bg-[#030712] shadow-2xl shadow-sky-950/20">
      <div ref={hostRef} className="absolute inset-0" />
      {!sceneReady && !webglUnavailable && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-[#030712] text-sm font-medium text-sky-200/80">
          Initialisation de l’amas stellaire…
        </div>
      )}
      {webglUnavailable && (
        <div role="alert" className="absolute inset-0 z-30 grid place-items-center bg-slate-950 p-6 text-center text-sm text-rose-200">
          Cette visualisation 3D nécessite un navigateur compatible WebGL.
        </div>
      )}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-start justify-between gap-3 bg-gradient-to-b from-slate-950/90 to-transparent p-4 sm:p-5">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-sky-300">EPEOR · Deep space data</p>
          <h3 className="mt-1 text-lg font-black text-white sm:text-xl">Amas globulaire des abonnés</h3>
          <p className="mt-1 text-xs text-slate-300">{subscribers.length.toLocaleString("fr-FR")} étoiles de données · {LEVEL_LABELS[activeLevel]}</p>
        </div>
        <div className="pointer-events-auto flex max-w-full flex-col items-end gap-2">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              searchRef.current(searchText);
            }}
            className="flex w-[min(360px,calc(100vw-40px))] gap-1 rounded-xl border border-white/10 bg-slate-950/75 p-1.5 backdrop-blur"
          >
            <input
              aria-label="Rechercher une commune, une tournée ou un abonné"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Commune, tournée, raison sociale…"
              className="min-w-0 flex-1 bg-transparent px-2 text-xs text-white outline-none placeholder:text-slate-500"
            />
            <button type="submit" className="rounded-lg bg-sky-300/15 px-3 py-1 text-xs font-bold text-sky-100 hover:bg-sky-300/25">
              Rechercher
            </button>
          </form>
          <div className="flex max-w-full flex-wrap items-center justify-end gap-1.5 rounded-xl border border-white/10 bg-slate-950/75 p-1.5 backdrop-blur">
            <BreadcrumbButton label="Communes" active={activeLevel === "commune"} onClick={() => navigateRef.current("commune")} />
            {breadcrumbs.map((node) => {
              const level: SceneLevel = node.level === "commune" ? "tournee" : node.level === "tournee" ? "type_abonne" : "abonne";
              return (
                <BreadcrumbButton
                  key={node.id}
                  label={node.label}
                  active={node.id === breadcrumbs[breadcrumbs.length - 1]?.id}
                  onClick={() => navigateRef.current(level, node)}
                />
              );
            })}
          </div>
          {searchError && <p role="status" className="rounded-lg bg-rose-950/80 px-2 py-1 text-[10px] text-rose-200">{searchError}</p>}
        </div>
      </header>
      <aside className="pointer-events-none absolute right-3 top-28 z-10 w-[min(290px,calc(100%-24px))] sm:right-4 sm:top-24">
        <div className="pointer-events-auto space-y-3 rounded-2xl border border-sky-300/20 bg-slate-950/75 p-3 shadow-xl shadow-sky-950/30 backdrop-blur-md sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-sky-300">Panneau de mission</p>
            <span className="rounded-full border border-sky-300/20 px-2 py-1 text-[9px] text-slate-300">
              {activeLevel === "commune" ? totalCounts.communes
                : activeLevel === "tournee" ? selectedPath[0]?.members.length
                  : activeLevel === "type_abonne" ? selectedPath[1]?.members.length
                    : selectedPath[2]?.members.length ?? 0} éléments
            </span>
          </div>
          <DetailCard entity={selectedEntity} />
          {activeLevel === "abonne" && (
            <div className="flex gap-1 rounded-lg bg-slate-900 p-1">
              <ColorModeButton active={colorMode === "compteur"} onClick={() => changeColorMode("compteur")}>Compteur</ColorModeButton>
              <ColorModeButton active={colorMode === "facture"} onClick={() => changeColorMode("facture")}>Facture</ColorModeButton>
            </div>
          )}
        </div>
      </aside>
      {hoverLabel && (
        <div className="pointer-events-none absolute bottom-20 left-4 z-10 max-w-[min(380px,calc(100%-32px))] rounded-lg border border-sky-200/20 bg-slate-950/80 px-3 py-2 text-xs font-semibold text-sky-100 shadow-lg backdrop-blur">
          {hoverLabel}
        </div>
      )}
      <footer className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-wrap items-end justify-between gap-3 bg-gradient-to-t from-slate-950/95 via-slate-950/65 to-transparent p-4 pt-12">
        <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[10px] text-slate-200">
          {activeLevel === "abonne" ? (
            colorMode === "compteur"
              ? (Object.entries(STATUS_LABELS) as [MeterStatus, string][]).map(([status, label]) => (
                <LegendItem key={status} color={`#${METER_COLORS[status].getHexString()}`} label={label} />
              ))
              : (
                <>
                  <LegendItem color="#4ade80" label="Facture payée" />
                  <LegendItem color="#fb7185" label="Facture impayée" />
                  <LegendItem color="#94a3b8" label="Statut inconnu" />
                </>
              )
          ) : (
            <>
              <LegendItem color="#7dd3fc" label="Communes" />
              <LegendItem color="#2dd4bf" label="Tournées" />
              <LegendItem color="#a78bfa" label="Types d’abonnés" />
              <LegendItem color="#fbbf24" label="Abonnés" />
            </>
          )}
        </div>
        <p className="text-[10px] text-slate-400">Molette : plongée · Glisser : orbiter · Clic sur un amas : explorer</p>
      </footer>
    </div>
  );
}

function BreadcrumbButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`max-w-40 truncate rounded-lg px-2.5 py-1.5 text-[10px] font-bold transition-colors ${
        active ? "bg-sky-300/15 text-sky-200" : "text-slate-300 hover:bg-white/10 hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}

function ColorModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-md px-2 py-1.5 text-[10px] font-bold transition-colors ${
        active ? "bg-sky-300/20 text-sky-100" : "text-slate-400 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full shadow-[0_0_8px_currentColor]" style={{ backgroundColor: color, color }} />
      {label}
    </span>
  );
}
