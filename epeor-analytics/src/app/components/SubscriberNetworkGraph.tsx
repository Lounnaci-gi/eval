"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent, type WheelEvent as ReactWheelEvent } from "react";
import { apiUrlObject } from "../lib/api";

type Subscriber = {
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
};
type Relation = "commune" | "type_abonne" | "tournee" | "raison_sociale";
type Position = { x: number; y: number };
type RelationGroup = {
  id: string;
  relation: Relation;
  label: string;
  members: string[];
  parentId: string | null;
  offset: Position;
  position: Position;
};
type NetworkEdge = { source: string; target: string; relation: Relation };
type NetworkLayout = {
  positions: Record<string, Position>;
  groups: RelationGroup[];
  edges: NetworkEdge[];
  width: number;
  height: number;
};

const NODE_RADIUS = 26;
const NODE_SPACING_X = 106;
const NODE_SPACING_Y = 86;
const FRAME_INTERVAL = 32;
const HIT_BUCKET_SIZE = 96;
const TOURNEE_ZOOM_THRESHOLD = 2;
const TYPE_ZOOM_THRESHOLD = 4;
const SUBSCRIBER_ZOOM_THRESHOLD = 7;
const RELATION_ORDER: Relation[] = ["commune", "tournee", "type_abonne", "raison_sociale"];
const STYLES: Record<Relation, { label: string; color: string }> = {
  commune: { label: "Commune", color: "#1d4ed8" },
  type_abonne: { label: "Type abonné", color: "#4f46e5" },
  tournee: { label: "Tournée", color: "#0891b2" },
  raison_sociale: { label: "Raison sociale", color: "#c2410c" },
};
const TYPE_COLORS = ["#4f46e5", "#7c3aed", "#0891b2", "#0f766e", "#c2410c", "#1d4ed8"];

function semanticOpacity(zoom: number, threshold: number) {
  return Math.max(0, Math.min(1, (zoom - threshold + 0.25) / 0.5));
}

function communeRadius(group: RelationGroup) {
  return Math.min(30, 12 + Math.sqrt(group.members.length) * 0.7);
}

function groupBelongsToCommune(
  group: RelationGroup,
  communeId: string | null,
  groupsById: Map<string, RelationGroup>,
) {
  if (!communeId) return true;
  let current: RelationGroup | undefined = group;
  while (current) {
    if (current.id === communeId) return true;
    current = current.parentId ? groupsById.get(current.parentId) : undefined;
  }
  return false;
}

function isGroupVisibleAtZoom(
  group: RelationGroup,
  zoomLevel: number,
  communeId: string | null,
  groupsById: Map<string, RelationGroup>,
) {
  const levelVisible = group.relation === "commune"
    || (group.relation === "tournee" && semanticOpacity(zoomLevel, TOURNEE_ZOOM_THRESHOLD) > 0)
    || (group.relation === "type_abonne" && semanticOpacity(zoomLevel, TYPE_ZOOM_THRESHOLD) > 0);
  return group.relation === "commune"
    || (levelVisible && groupBelongsToCommune(group, communeId, groupsById));
}

function normalized(value: string | undefined) {
  const result = String(value ?? "").trim().toLocaleLowerCase("fr");
  return result && result !== "—" && result !== "-" ? result : "";
}

function typeColor(type: string) {
  let hash = 0;
  for (const character of normalized(type)) hash = (hash * 31 + character.charCodeAt(0)) | 0;
  return TYPE_COLORS[Math.abs(hash) % TYPE_COLORS.length];
}

function pointToSegmentDistance(point: Position, start: Position, end: Position) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (!lengthSquared) return Math.hypot(point.x - start.x, point.y - start.y);
  const ratio = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (start.x + ratio * dx), point.y - (start.y + ratio * dy));
}

function createNetworkLayout(subscribers: Subscriber[]): NetworkLayout {
  const columns = Math.max(1, Math.ceil(Math.sqrt(subscribers.length)));
  const rows = Math.max(1, Math.ceil(subscribers.length / columns));
  const width = Math.max(900, columns * NODE_SPACING_X + 80);
  const height = Math.max(600, rows * NODE_SPACING_Y + 80);
  const positions: Record<string, Position> = {};
  subscribers.forEach((subscriber, index) => {
    positions[subscriber.numab] = {
      x: 40 + (index % columns) * NODE_SPACING_X + (Math.floor(index / columns) % 2) * 18,
      y: 40 + Math.floor(index / columns) * NODE_SPACING_Y,
    };
  });

  const communeGroups = new Map<string, { label: string; members: string[] }>();
  const tourneeGroups = new Map<string, { label: string; parentId: string; members: string[] }>();
  const typeGroups = new Map<string, { label: string; parentId: string; members: string[] }>();
  const subscriberType = new Map<string, string>();

  for (const subscriber of subscribers) {
    const communeKey = normalized(subscriber.codcom) || normalized(subscriber.commune) || "inconnue";
    const commune = communeGroups.get(communeKey) ?? {
      label: subscriber.commune || subscriber.codcom || "Commune inconnue",
      members: [],
    };
    commune.members.push(subscriber.numab);
    communeGroups.set(communeKey, commune);
    const communeId = `commune:${communeKey}`;

    const tourneeKey = normalized(subscriber.tournee) || "inconnue";
    const tourneeId = `tournee:${communeKey}:${tourneeKey}`;
    const tournee = tourneeGroups.get(tourneeId) ?? {
      label: subscriber.tournee || "Tournée inconnue",
      parentId: communeId,
      members: [],
    };
    tournee.members.push(subscriber.numab);
    tourneeGroups.set(tourneeId, tournee);

    const typeKey = normalized(subscriber.typabon) || normalized(subscriber.type_abonne) || "inconnu";
    const typeId = `type_abonne:${communeKey}:${tourneeKey}:${typeKey}`;
    const type = typeGroups.get(typeId) ?? {
      label: subscriber.type_abonne || subscriber.typabon || "Type inconnu",
      parentId: tourneeId,
      members: [],
    };
    type.members.push(subscriber.numab);
    typeGroups.set(typeId, type);
    subscriberType.set(subscriber.numab, typeId);
  }

  const relationOffsets: Record<Exclude<Relation, "raison_sociale">, Position> = {
    commune: { x: -24, y: -12 },
    type_abonne: { x: -8, y: 18 },
    tournee: { x: 8, y: -18 },
  };
  const groups: RelationGroup[] = [];
  const addGroups = (
    relation: Exclude<Relation, "raison_sociale">,
    values: Map<string, { label: string; parentId?: string; members: string[] }>,
  ) => {
    for (const [id, group] of values) {
      const center = group.members.reduce(
        (sum, numab) => ({
          x: sum.x + positions[numab].x / group.members.length,
          y: sum.y + positions[numab].y / group.members.length,
        }),
        { x: 0, y: 0 },
      );
      const offset = relationOffsets[relation];
      groups.push({
        id,
        relation,
        label: group.label,
        members: group.members,
        parentId: group.parentId ?? null,
        offset,
        position: { x: center.x + offset.x, y: center.y + offset.y },
      });
    }
  };

  addGroups(
    "commune",
    new Map([...communeGroups].map(([key, group]) => [
      `commune:${key}`,
      { label: group.label, members: group.members },
    ])),
  );
  const communes = groups.filter((group) => group.relation === "commune");
  const communeColumns = Math.max(1, Math.ceil(Math.sqrt(communes.length * 1.6)));
  const communeRows = Math.ceil(communes.length / communeColumns);
  const communeSpacingX = 170;
  const communeSpacingY = 140;
  const communeOriginX = (900 - (communeColumns - 1) * communeSpacingX) / 2;
  const communeOriginY = (600 - (communeRows - 1) * communeSpacingY) / 2;
  communes.forEach((group, index) => {
    group.position = {
      x: communeOriginX + (index % communeColumns) * communeSpacingX,
      y: communeOriginY + Math.floor(index / communeColumns) * communeSpacingY,
    };
  });
  addGroups("tournee", new Map(tourneeGroups));
  addGroups("type_abonne", new Map(typeGroups));

  for (const parent of groups.filter((group) => group.relation === "commune")) {
    const children = groups.filter((group) => group.relation === "tournee" && group.parentId === parent.id);
    const radius = Math.max(100, Math.sqrt(children.length) * 36);
    children.forEach((group, index) => {
      const angle = (index / Math.max(1, children.length)) * Math.PI * 2;
      group.position = {
        x: parent.position.x + Math.cos(angle) * radius,
        y: parent.position.y + Math.sin(angle) * radius,
      };
    });
  }
  for (const parent of groups.filter((group) => group.relation === "tournee")) {
    const children = groups.filter((group) => group.relation === "type_abonne" && group.parentId === parent.id);
    const radius = Math.max(48, Math.sqrt(children.length) * 22);
    children.forEach((group, index) => {
      const angle = (index / Math.max(1, children.length)) * Math.PI * 2;
      group.position = {
        x: parent.position.x + Math.cos(angle) * radius,
        y: parent.position.y + Math.sin(angle) * radius,
      };
    });
  }

  const edges: NetworkEdge[] = [];
  for (const group of groups) {
    if (group.parentId) edges.push({ source: group.parentId, target: group.id, relation: group.relation });
  }
  for (const [numab, typeId] of subscriberType) {
    edges.push({ source: typeId, target: `subscriber:${numab}`, relation: "raison_sociale" });
  }

  return { positions, groups, edges, width, height };
}

function NetworkMap({ subscribers, layout }: { subscribers: Subscriber[]; layout: NetworkLayout }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const positionsRef = useRef<Record<string, Position>>(layout.positions);
  const anchorsRef = useRef<Record<string, Position>>(layout.positions);
  const groupPositionsRef = useRef<Record<string, Position>>(
    Object.fromEntries(layout.groups.map((group) => [group.id, group.position])),
  );
  const manualGroupOffsetsRef = useRef<Record<string, Position>>({});
  const dragRef = useRef<
    | { kind: "subscriber"; numab: string; pointerId: number }
    | { kind: "group"; id: string; pointerId: number; lastWorld: Position }
    | { kind: "pan"; pointerId: number; last: Position }
    | null
  >(null);
  const pointerRef = useRef<Position | null>(null);
  const hoverRef = useRef<{ origin: Position; startedAt: number; active: boolean; stoppedAt?: number; targetId: string } | null>(null);
  const hitBucketsRef = useRef<Map<string, string[]>>(new Map());
  const lastLinkHitTestRef = useRef(0);
  const [canvasSize, setCanvasSize] = useState({ width: 900, height: 600 });
  const [hoverLabel, setHoverLabel] = useState("");
  const cameraRef = useRef({ scale: 1, baseScale: 1, x: 0, y: 0 });
  const focusedCommuneRef = useRef<string | null>(null);
  const focusedSubscriberIdsRef = useRef<Set<string>>(new Set());
  const subscriberNames = useMemo(
    () => new Map(subscribers.map((subscriber) => [subscriber.numab, subscriber.name])),
    [subscribers],
  );
  const subscribersById = useMemo(
    () => new Map(subscribers.map((subscriber) => [subscriber.numab, subscriber])),
    [subscribers],
  );
  const groupsById = useMemo(
    () => new Map(layout.groups.map((group) => [group.id, group])),
    [layout.groups],
  );

  useEffect(() => {
    positionsRef.current = layout.positions;
    anchorsRef.current = layout.positions;
    groupPositionsRef.current = Object.fromEntries(layout.groups.map((group) => [group.id, group.position]));
    manualGroupOffsetsRef.current = {};
    focusedCommuneRef.current = null;
    focusedSubscriberIdsRef.current = new Set();
  }, [layout]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const updateSize = () => {
      const width = Math.round(viewport.clientWidth);
      const height = Math.round(viewport.clientHeight);
      setCanvasSize((current) => (
        current.width === width && current.height === height ? current : { width, height }
      ));
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (canvasSize.width <= 0 || canvasSize.height <= 0) return;
    const communes = layout.groups.filter((group) => group.relation === "commune");
    if (communes.length === 0) return;
    const motionPadding = 100;
    const minX = Math.min(...communes.map((group) => group.position.x - communeRadius(group))) - motionPadding;
    const maxX = Math.max(...communes.map((group) => group.position.x + communeRadius(group))) + motionPadding;
    const minY = Math.min(...communes.map((group) => group.position.y - communeRadius(group))) - motionPadding;
    const maxY = Math.max(...communes.map((group) => group.position.y + communeRadius(group))) + motionPadding;
    const boundsWidth = Math.max(1, maxX - minX);
    const boundsHeight = Math.max(1, maxY - minY);
    const baseScale = Math.min(
      1,
      (canvasSize.width - 72) / boundsWidth,
      (canvasSize.height - 72) / boundsHeight,
    );
    const scale = Math.max(0.001, baseScale);
    cameraRef.current = {
      scale,
      baseScale: scale,
      x: (canvasSize.width - boundsWidth * scale) / 2 - minX * scale,
      y: (canvasSize.height - boundsHeight * scale) / 2 - minY * scale,
    };
  }, [canvasSize, layout]);

  useEffect(() => {
    let frameId = 0;
    let lastFrameTime = 0;
    const velocities: Record<string, Position> = {};
    const communes = layout.groups.filter((group) => group.relation === "commune");
    const communeBounds = {
      minX: Math.min(...communes.map((group) => group.position.x)) - 100,
      maxX: Math.max(...communes.map((group) => group.position.x)) + 100,
      minY: Math.min(...communes.map((group) => group.position.y)) - 100,
      maxY: Math.max(...communes.map((group) => group.position.y)) + 100,
    };
    communes.forEach((group, index) => {
      const angle = index * 2.399;
      velocities[group.id] = { x: Math.cos(angle) * 22, y: Math.sin(angle) * 22 };
    });
    subscribers.forEach(({ numab }) => {
      velocities[numab] = { x: 0, y: 0 };
    });

    const animate = (time: number) => {
      frameId = window.requestAnimationFrame(animate);
      const canvas = canvasRef.current;
      const viewport = viewportRef.current;
      const context = canvas?.getContext("2d");
      if (!canvas || !viewport || !context || time - lastFrameTime < FRAME_INTERVAL) return;

      const camera = cameraRef.current;
      const zoomLevel = camera.scale / camera.baseScale;
      const project = (point: Position): Position => ({
        x: point.x * camera.scale + camera.x,
        y: point.y * camera.scale + camera.y,
      });
      const elapsed = time / 1000;
      const deltaSeconds = lastFrameTime ? Math.min(0.05, (time - lastFrameTime) / 1000) : 0;
      const positions = positionsRef.current;
      const anchors = anchorsRef.current;
      const hover = hoverRef.current;
      if (hover && !hover.active && hover.stoppedAt && time - hover.stoppedAt > 1800) {
        hoverRef.current = null;
      }
      const waveElapsed = hover
        ? Math.max(0, ((hover.active ? time : hover.stoppedAt ?? time) - hover.startedAt) / 1000)
        : 10;

      for (const [index, subscriber] of subscribers.entries()) {
        const anchor = anchors[subscriber.numab];
        const current = positions[subscriber.numab];
        if (!anchor || !current) continue;
        const phase = index * 2.17 + subscriber.numab.length;
        const dx = anchor.x - (hover?.origin.x ?? 0);
        const dy = anchor.y - (hover?.origin.y ?? 0);
        const distance = Math.hypot(dx, dy);
        const angle = distance ? Math.atan2(dy, dx) : 0;
        const wave = hover && waveElapsed <= 1.8
          ? Math.sin(waveElapsed * 11 - distance / 24) * Math.exp(-waveElapsed * 1.9) * 11
          : 0;
        const velocity = velocities[subscriber.numab];
        const targetX = anchor.x + Math.sin(elapsed * 0.65 + phase) * 4 + Math.cos(angle) * wave;
        const targetY = anchor.y + Math.cos(elapsed * 0.8 + phase) * 4 + Math.sin(angle) * wave;
        velocity.x = (velocity.x + (targetX - current.x) * 0.018) * 0.905;
        velocity.y = (velocity.y + (targetY - current.y) * 0.018) * 0.905;
        positions[subscriber.numab] = {
          x: Math.max(NODE_RADIUS, Math.min(layout.width - NODE_RADIUS, current.x + velocity.x)),
          y: Math.max(NODE_RADIUS, Math.min(layout.height - NODE_RADIUS, current.y + velocity.y)),
        };
      }
      for (const [index, group] of communes.entries()) {
        const position = groupPositionsRef.current[group.id] ?? group.position;
        const velocity = velocities[group.id];
        const radius = communeRadius(group);
        const phase = index * 2.399;
        const isDragging = dragRef.current?.kind === "group" && dragRef.current.id === group.id;
        if (!isDragging) {
          velocity.x += Math.sin(elapsed * 0.9 + phase) * 3 * deltaSeconds;
          velocity.y += Math.cos(elapsed * 0.8 + phase) * 3 * deltaSeconds;
          position.x += velocity.x * deltaSeconds;
          position.y += velocity.y * deltaSeconds;
          if (position.x < communeBounds.minX + radius) {
            position.x = communeBounds.minX + radius;
            velocity.x = Math.abs(velocity.x);
          } else if (position.x > communeBounds.maxX - radius) {
            position.x = communeBounds.maxX - radius;
            velocity.x = -Math.abs(velocity.x);
          }
          if (position.y < communeBounds.minY + radius) {
            position.y = communeBounds.minY + radius;
            velocity.y = Math.abs(velocity.y);
          } else if (position.y > communeBounds.maxY - radius) {
            position.y = communeBounds.maxY - radius;
            velocity.y = -Math.abs(velocity.y);
          }
        }
        groupPositionsRef.current[group.id] = position;
      }
      for (let first = 0; first < communes.length; first += 1) {
        const firstGroup = communes[first];
        const firstPosition = groupPositionsRef.current[firstGroup.id];
        const firstVelocity = velocities[firstGroup.id];
        for (let second = first + 1; second < communes.length; second += 1) {
          const secondGroup = communes[second];
          const secondPosition = groupPositionsRef.current[secondGroup.id];
          const secondVelocity = velocities[secondGroup.id];
          let dx = secondPosition.x - firstPosition.x;
          let dy = secondPosition.y - firstPosition.y;
          let distance = Math.hypot(dx, dy);
          const minimumDistance = communeRadius(firstGroup) + communeRadius(secondGroup);
          if (distance >= minimumDistance) continue;
          if (distance === 0) {
            dx = 1;
            distance = 1;
          }
          const normalX = dx / distance;
          const normalY = dy / distance;
          const overlap = minimumDistance - distance;
          firstPosition.x -= normalX * overlap * 0.5;
          firstPosition.y -= normalY * overlap * 0.5;
          secondPosition.x += normalX * overlap * 0.5;
          secondPosition.y += normalY * overlap * 0.5;
          const relativeSpeed = (secondVelocity.x - firstVelocity.x) * normalX
            + (secondVelocity.y - firstVelocity.y) * normalY;
          if (relativeSpeed < 0) {
            firstVelocity.x += relativeSpeed * normalX;
            firstVelocity.y += relativeSpeed * normalY;
            secondVelocity.x -= relativeSpeed * normalX;
            secondVelocity.y -= relativeSpeed * normalY;
          }
        }
      }
      const groupPositions: Record<string, Position> = {};
      for (const group of layout.groups) {
        if (group.relation === "commune") {
          groupPositions[group.id] = groupPositionsRef.current[group.id] ?? { ...group.position };
          continue;
        }
        const parentPosition = group.parentId ? groupPositions[group.parentId] : undefined;
        const parentGroup = group.parentId ? groupsById.get(group.parentId) : undefined;
        groupPositions[group.id] = parentPosition && parentGroup
          ? {
            x: parentPosition.x + group.position.x - parentGroup.position.x,
            y: parentPosition.y + group.position.y - parentGroup.position.y,
          }
          : { ...group.position };
        const manualOffset = manualGroupOffsetsRef.current[group.id];
        if (manualOffset) {
          groupPositions[group.id].x += manualOffset.x;
          groupPositions[group.id].y += manualOffset.y;
        }
      }
      groupPositionsRef.current = groupPositions;
      const focusedCommuneId = focusedCommuneRef.current;
      const belongsToFocusedCommune = (groupId: string) => {
        if (!focusedCommuneId) return true;
        let group = groupsById.get(groupId);
        while (group) {
          if (group.id === focusedCommuneId) return true;
          group = group.parentId ? groupsById.get(group.parentId) : undefined;
        }
        return false;
      };
      const isInFocus = (id: string) => id.startsWith("subscriber:")
        ? !focusedCommuneId || focusedSubscriberIdsRef.current.has(id.slice("subscriber:".length))
        : belongsToFocusedCommune(id);

      const canvasWidth = canvas.clientWidth;
      const canvasHeight = canvas.clientHeight;
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
      if (canvas.width !== Math.round(canvasWidth * pixelRatio) || canvas.height !== Math.round(canvasHeight * pixelRatio)) {
        canvas.width = Math.round(canvasWidth * pixelRatio);
        canvas.height = Math.round(canvasHeight * pixelRatio);
      }
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.clearRect(0, 0, canvasWidth, canvasHeight);

      for (const edge of layout.edges) {
        const threshold = edge.relation === "type_abonne"
          ? TYPE_ZOOM_THRESHOLD
          : edge.relation === "tournee"
            ? TOURNEE_ZOOM_THRESHOLD
            : SUBSCRIBER_ZOOM_THRESHOLD;
        const opacity = semanticOpacity(zoomLevel, threshold);
        if (opacity === 0) continue;
        if (!isInFocus(edge.source) || !isInFocus(edge.target)) continue;
        const source = edge.source.startsWith("subscriber:")
          ? positions[edge.source.slice("subscriber:".length)]
          : groupPositions[edge.source];
        const target = edge.target.startsWith("subscriber:")
          ? positions[edge.target.slice("subscriber:".length)]
          : groupPositions[edge.target];
        if (!source || !target) continue;
        const sourceScreen = project(source);
        const targetScreen = project(target);
        if (
          Math.max(sourceScreen.x, targetScreen.x) < 0
          || Math.min(sourceScreen.x, targetScreen.x) > canvasWidth
          || Math.max(sourceScreen.y, targetScreen.y) < 0
          || Math.min(sourceScreen.y, targetScreen.y) > canvasHeight
        ) continue;
        context.strokeStyle = STYLES[edge.relation].color;
        context.globalAlpha = 0.38 * opacity;
        context.lineWidth = Math.max(0.6, 1.4 * camera.scale);
        context.beginPath();
        context.moveTo(sourceScreen.x, sourceScreen.y);
        context.lineTo(targetScreen.x, targetScreen.y);
        context.stroke();
        context.globalAlpha = 1;
      }

      for (const group of layout.groups) {
        if (!isGroupVisibleAtZoom(group, zoomLevel, focusedCommuneId, groupsById)) continue;
        const opacity = group.relation === "commune"
          ? 1
          : semanticOpacity(zoomLevel, group.relation === "type_abonne" ? TYPE_ZOOM_THRESHOLD : TOURNEE_ZOOM_THRESHOLD);
        const position = groupPositions[group.id];
        if (!position) continue;
        const screen = project(position);
        const x = screen.x;
        const y = screen.y;
        const nodeRadius = group.relation === "commune"
          ? communeRadius(group)
          : Math.max(5, 10 * Math.min(camera.scale / camera.baseScale, 1.5));
        if (x < -nodeRadius - 12 || y < -nodeRadius - 12 || x > canvasWidth + nodeRadius + 12 || y > canvasHeight + nodeRadius + 12) continue;
        context.fillStyle = group.relation === "type_abonne"
          ? typeColor(group.label)
          : STYLES[group.relation].color;
        context.globalAlpha = opacity;
        context.beginPath();
        context.arc(x, y, nodeRadius, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = "#ffffff";
        context.font = `700 ${Math.max(9, 10 * Math.min(camera.scale / camera.baseScale, 1.4))}px Poppins, sans-serif`;
        context.textAlign = "center";
        context.textBaseline = "middle";
        if (zoomLevel < TYPE_ZOOM_THRESHOLD) {
          context.fillText(group.members.length.toLocaleString("fr-FR"), x, y);
          context.globalAlpha = 1;
          context.fillStyle = "#344054";
          context.font = "600 11px Poppins, sans-serif";
          context.fillText(group.label, x, y + nodeRadius + 12, Math.max(100, nodeRadius * 6));
        } else {
          context.fillText(group.label, x, y, Math.max(72, nodeRadius * 5));
          if (group.relation === "commune") {
            context.font = "600 9px Poppins, sans-serif";
            context.fillText(group.members.length.toLocaleString("fr-FR"), x, y + nodeRadius + 10);
          }
        }
        context.globalAlpha = 1;
      }

      const subscriberOpacity = semanticOpacity(zoomLevel, SUBSCRIBER_ZOOM_THRESHOLD);
      if (subscriberOpacity > 0) for (const subscriber of subscribers) {
        if (focusedCommuneId && !focusedSubscriberIdsRef.current.has(subscriber.numab)) continue;
        const position = positions[subscriber.numab];
        if (!position) continue;
        const screen = project(position);
        const x = screen.x;
        const y = screen.y;
        const radius = Math.max(4, NODE_RADIUS * Math.min(camera.scale / camera.baseScale / SUBSCRIBER_ZOOM_THRESHOLD, 1));
        if (x < -radius || y < -radius || x > canvasWidth + radius || y > canvasHeight + radius) continue;
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        const nodeColor = typeColor(subscriber.type_abonne || subscriber.typabon);
        context.fillStyle = `${nodeColor}20`;
        context.globalAlpha = subscriberOpacity;
        context.fill();
        context.lineWidth = Math.max(1, 2 * camera.scale / camera.baseScale / SUBSCRIBER_ZOOM_THRESHOLD);
        context.strokeStyle = nodeColor;
        context.stroke();
        context.fillStyle = nodeColor;
        context.font = `${Math.max(7, 9 * camera.scale / camera.baseScale / SUBSCRIBER_ZOOM_THRESHOLD)}px Poppins, sans-serif`;
        context.textAlign = "center";
        context.textBaseline = "middle";
        const label = subscriber.numab.length > 12 ? `${subscriber.numab.slice(0, 11)}…` : subscriber.numab;
        context.fillText(label, x, y, radius * 1.8);
        if (radius >= 10) {
          context.font = "600 8px Poppins, sans-serif";
          context.fillText(subscriber.raison_sociale || subscriber.name, x, y + radius + 9, NODE_SPACING_X - 8);
        }
        context.globalAlpha = 1;
      }
      const hitBuckets = new Map<string, string[]>();
      for (const subscriber of subscribers) {
        const position = positions[subscriber.numab];
        if (!position) continue;
        const key = `${Math.floor(position.x / HIT_BUCKET_SIZE)},${Math.floor(position.y / HIT_BUCKET_SIZE)}`;
        const members = hitBuckets.get(key) ?? [];
        members.push(subscriber.numab);
        hitBuckets.set(key, members);
      }
      hitBucketsRef.current = hitBuckets;

      context.globalAlpha = 1;
      const pointer = pointerRef.current;
      if (pointer) {
        context.strokeStyle = "rgba(29, 78, 216, 0.22)";
        context.lineWidth = 1;
        for (const subscriber of subscribers) {
          const node = positions[subscriber.numab];
          if (!node) continue;
          const nodeScreen = project(node);
          const distance = Math.hypot(pointer.x - nodeScreen.x, pointer.y - nodeScreen.y);
          if (subscriberOpacity > 0 && distance < NODE_RADIUS * camera.scale + 4) {
            context.strokeStyle = "#1d4ed8";
            context.lineWidth = 2;
            context.beginPath();
            context.arc(nodeScreen.x, nodeScreen.y, NODE_RADIUS * camera.scale + 3, 0, Math.PI * 2);
            context.stroke();
            break;
          }
        }
      }

      lastFrameTime = time;
    };

    frameId = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frameId);
  }, [groupsById, layout, subscribers]);

  const toWorldPosition = (event: PointerEvent<HTMLCanvasElement>): Position => {
    const canvas = canvasRef.current;
    const bounds = canvas?.getBoundingClientRect();
    const camera = cameraRef.current;
    return {
      x: (event.clientX - (bounds?.left ?? 0) - camera.x) / camera.scale,
      y: (event.clientY - (bounds?.top ?? 0) - camera.y) / camera.scale,
    };
  };

  const toScreenPosition = (event: Pick<PointerEvent<HTMLCanvasElement>, "clientX" | "clientY">): Position => {
    const bounds = canvasRef.current?.getBoundingClientRect();
    return {
      x: event.clientX - (bounds?.left ?? 0),
      y: event.clientY - (bounds?.top ?? 0),
    };
  };

  const handleWheel = (event: ReactWheelEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const screen = toScreenPosition(event);
    const camera = cameraRef.current;
    const world = {
      x: (screen.x - camera.x) / camera.scale,
      y: (screen.y - camera.y) / camera.scale,
    };
    const nextScale = Math.max(
      camera.baseScale,
      Math.min(camera.baseScale * 32, camera.scale * (event.deltaY < 0 ? 1.15 : 1 / 1.15)),
    );
    const nextZoomLevel = nextScale / camera.baseScale;
    const hoveredCommune = layout.groups
      .filter((group) => group.relation === "commune")
      .map((group) => {
        const position = groupPositionsRef.current[group.id];
        const nodeScreen = position
          ? { x: position.x * camera.scale + camera.x, y: position.y * camera.scale + camera.y }
          : null;
        return {
          group,
          distance: nodeScreen ? Math.hypot(screen.x - nodeScreen.x, screen.y - nodeScreen.y) : Infinity,
        };
      })
      .filter(({ group, distance }) => distance <= communeRadius(group) * camera.scale + 12)
      .sort((a, b) => a.distance - b.distance)[0]?.group;
    if (hoveredCommune && nextZoomLevel >= TOURNEE_ZOOM_THRESHOLD) {
      focusedCommuneRef.current = hoveredCommune.id;
      focusedSubscriberIdsRef.current = new Set(hoveredCommune.members);
    } else if (nextZoomLevel < TOURNEE_ZOOM_THRESHOLD) {
      focusedCommuneRef.current = null;
      focusedSubscriberIdsRef.current = new Set();
    }
    cameraRef.current = {
      ...camera,
      scale: nextScale,
      x: screen.x - world.x * nextScale,
      y: screen.y - world.y * nextScale,
    };
  };

  const startWave = (origin: Position, startedAt: number, targetId: string) => {
    if (hoverRef.current?.targetId === targetId) {
      hoverRef.current.active = true;
      return;
    }
    hoverRef.current = { origin, startedAt, active: true, targetId };
  };

  const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const screen = toScreenPosition(event);
    const world = toWorldPosition(event);
    const drag = dragRef.current;
    if (drag?.kind === "pan") {
      cameraRef.current.x += screen.x - drag.last.x;
      cameraRef.current.y += screen.y - drag.last.y;
      drag.last = screen;
      return;
    }
    if (drag?.kind === "subscriber") {
      positionsRef.current[drag.numab] = {
        x: Math.max(NODE_RADIUS, Math.min(layout.width - NODE_RADIUS, world.x)),
        y: Math.max(NODE_RADIUS, Math.min(layout.height - NODE_RADIUS, world.y)),
      };
      anchorsRef.current[drag.numab] = positionsRef.current[drag.numab];
      return;
    }
    if (drag?.kind === "group") {
      const delta = { x: world.x - drag.lastWorld.x, y: world.y - drag.lastWorld.y };
      const group = groupsById.get(drag.id);
      const position = groupPositionsRef.current[drag.id];
      if (group && position) {
        if (group.relation === "commune") {
          position.x += delta.x;
          position.y += delta.y;
        } else {
          const offset = manualGroupOffsetsRef.current[drag.id] ?? { x: 0, y: 0 };
          manualGroupOffsetsRef.current[drag.id] = {
            x: offset.x + delta.x,
            y: offset.y + delta.y,
          };
          position.x += delta.x;
          position.y += delta.y;
        }
      }
      drag.lastWorld = world;
      return;
    }

    pointerRef.current = screen;
    const zoomLevel = cameraRef.current.scale / cameraRef.current.baseScale;
    let nearest: { numab: string; position: Position; distance: number } | null = null;
    const bucketX = Math.floor(world.x / HIT_BUCKET_SIZE);
    const bucketY = Math.floor(world.y / HIT_BUCKET_SIZE);
    const candidates = new Set<string>();
    for (let x = bucketX - 1; x <= bucketX + 1; x += 1) {
      for (let y = bucketY - 1; y <= bucketY + 1; y += 1) {
        for (const numab of hitBucketsRef.current.get(`${x},${y}`) ?? []) candidates.add(numab);
      }
    }
    for (const numab of zoomLevel >= SUBSCRIBER_ZOOM_THRESHOLD ? candidates : []) {
      if (focusedCommuneRef.current && !focusedSubscriberIdsRef.current.has(numab)) continue;
      const position = positionsRef.current[numab];
      if (!position) continue;
      const nodeScreen = {
        x: position.x * cameraRef.current.scale + cameraRef.current.x,
        y: position.y * cameraRef.current.scale + cameraRef.current.y,
      };
      const distance = Math.hypot(screen.x - nodeScreen.x, screen.y - nodeScreen.y);
      const radius = Math.max(4, NODE_RADIUS * Math.min(zoomLevel / SUBSCRIBER_ZOOM_THRESHOLD, 1));
      if (distance <= radius + 8 && (!nearest || distance < nearest.distance)) {
        nearest = { numab, position, distance };
      }
    }

    if (nearest) {
      setHoverLabel(`${subscriberNames.get(nearest.numab) || "Abonné"} · ${nearest.numab}`);
      startWave(nearest.position, event.timeStamp, nearest.numab);
      return;
    }

    if (event.timeStamp - lastLinkHitTestRef.current < 70) return;
    lastLinkHitTestRef.current = event.timeStamp;
    let nearestHub: RelationGroup | null = null;
    let hubDistance = 16;
    for (const group of layout.groups) {
      if (!isGroupVisibleAtZoom(group, zoomLevel, focusedCommuneRef.current, groupsById)) continue;
      const position = groupPositionsRef.current[group.id];
      if (!position) continue;
      const screenPosition = {
        x: position.x * cameraRef.current.scale + cameraRef.current.x,
        y: position.y * cameraRef.current.scale + cameraRef.current.y,
      };
      const distance = Math.hypot(screen.x - screenPosition.x, screen.y - screenPosition.y);
      if (distance < hubDistance) {
        hubDistance = distance;
        nearestHub = group;
      }
    }
    if (nearestHub) {
      setHoverLabel(`${STYLES[nearestHub.relation].label} : ${nearestHub.label}`);
      startWave(groupPositionsRef.current[nearestHub.id], event.timeStamp, nearestHub.id);
      event.currentTarget.style.cursor = "grab";
      return;
    }
    event.currentTarget.style.cursor = "default";

    let nearestEdge: NetworkEdge | null = null;
    let nearestDistance = 9;
    const worldPointer = world;
    const screenPointer = screen;
    const camera = cameraRef.current;
    const edgePosition = (id: string) => id.startsWith("subscriber:")
      ? positionsRef.current[id.slice("subscriber:".length)]
      : groupPositionsRef.current[id];
    const focusedId = focusedCommuneRef.current;
    const edgeInFocus = (id: string) => {
      if (!focusedId) return true;
      if (id.startsWith("subscriber:")) return focusedSubscriberIdsRef.current.has(id.slice("subscriber:".length));
      const group = groupsById.get(id);
      return Boolean(group && groupBelongsToCommune(group, focusedId, groupsById));
    };
    for (const edge of layout.edges) {
      const threshold = edge.relation === "type_abonne"
        ? TYPE_ZOOM_THRESHOLD
        : edge.relation === "tournee"
          ? TOURNEE_ZOOM_THRESHOLD
          : SUBSCRIBER_ZOOM_THRESHOLD;
      if (semanticOpacity(zoomLevel, threshold) === 0) continue;
      if (!edgeInFocus(edge.source) || !edgeInFocus(edge.target)) continue;
      const source = edgePosition(edge.source);
      const target = edgePosition(edge.target);
      if (!source || !target) continue;
      const sourceScreen = { x: source.x * camera.scale + camera.x, y: source.y * camera.scale + camera.y };
      const targetScreen = { x: target.x * camera.scale + camera.x, y: target.y * camera.scale + camera.y };
      if (
        screenPointer.x < Math.min(sourceScreen.x, targetScreen.x) - nearestDistance
        || screenPointer.x > Math.max(sourceScreen.x, targetScreen.x) + nearestDistance
        || screenPointer.y < Math.min(sourceScreen.y, targetScreen.y) - nearestDistance
        || screenPointer.y > Math.max(sourceScreen.y, targetScreen.y) + nearestDistance
      ) continue;
      const distance = pointToSegmentDistance(screenPointer, sourceScreen, targetScreen);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestEdge = edge;
      }
    }
    if (nearestEdge) {
      if (nearestEdge.relation === "raison_sociale") {
        const numab = nearestEdge.target.slice("subscriber:".length);
        const subscriber = subscribersById.get(numab);
        setHoverLabel(`Raison sociale : ${subscriber?.raison_sociale || subscriber?.name || numab}`);
      } else {
        const relationNode = groupsById.get(nearestEdge.target);
        setHoverLabel(`${STYLES[nearestEdge.relation].label} : ${relationNode?.label ?? ""}`);
      }
      startWave(worldPointer, event.timeStamp, nearestEdge.target);
    } else {
      setHoverLabel("");
      if (hoverRef.current) {
        hoverRef.current.active = false;
        hoverRef.current.stoppedAt = event.timeStamp;
      }
    }
  };

  const handlePointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    const screen = toScreenPosition(event);
    const world = toWorldPosition(event);
    const zoomLevel = cameraRef.current.scale / cameraRef.current.baseScale;
    let nearest: { numab: string; distance: number } | null = null;
    const bucketX = Math.floor(world.x / HIT_BUCKET_SIZE);
    const bucketY = Math.floor(world.y / HIT_BUCKET_SIZE);
    const candidates = new Set<string>();
    if (zoomLevel >= SUBSCRIBER_ZOOM_THRESHOLD) {
      for (let x = bucketX - 1; x <= bucketX + 1; x += 1) {
        for (let y = bucketY - 1; y <= bucketY + 1; y += 1) {
          for (const numab of hitBucketsRef.current.get(`${x},${y}`) ?? []) candidates.add(numab);
        }
      }
    }
    for (const numab of candidates) {
      const position = positionsRef.current[numab];
      if (!position) continue;
      const nodeScreen = {
        x: position.x * cameraRef.current.scale + cameraRef.current.x,
        y: position.y * cameraRef.current.scale + cameraRef.current.y,
      };
      const distance = Math.hypot(screen.x - nodeScreen.x, screen.y - nodeScreen.y);
      const radius = Math.max(4, NODE_RADIUS * Math.min(zoomLevel / SUBSCRIBER_ZOOM_THRESHOLD, 1));
      if (distance <= radius && (!nearest || distance < nearest.distance)) {
        nearest = { numab, distance };
      }
    }
    if (nearest) {
      dragRef.current = { kind: "subscriber", numab: nearest.numab, pointerId: event.pointerId };
      event.currentTarget.style.cursor = "grabbing";
    } else {
      let nearestGroup: { group: RelationGroup; distance: number } | null = null;
      for (const group of [...layout.groups].reverse()) {
        if (!isGroupVisibleAtZoom(group, zoomLevel, focusedCommuneRef.current, groupsById)) continue;
        const position = groupPositionsRef.current[group.id];
        if (!position) continue;
        const nodeScreen = {
          x: position.x * cameraRef.current.scale + cameraRef.current.x,
          y: position.y * cameraRef.current.scale + cameraRef.current.y,
        };
        const distance = Math.hypot(screen.x - nodeScreen.x, screen.y - nodeScreen.y);
        const radius = group.relation === "commune"
          ? communeRadius(group) * cameraRef.current.scale
          : Math.max(10, 10 * cameraRef.current.scale / cameraRef.current.baseScale);
        if (distance <= radius + 5 && (!nearestGroup || distance < nearestGroup.distance)) {
          nearestGroup = { group, distance };
        }
      }
      if (nearestGroup) {
        dragRef.current = {
          kind: "group",
          id: nearestGroup.group.id,
          pointerId: event.pointerId,
          lastWorld: world,
        };
        event.currentTarget.style.cursor = "grabbing";
      } else {
        dragRef.current = { kind: "pan", pointerId: event.pointerId, last: screen };
        event.currentTarget.style.cursor = "grabbing";
      }
    }
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const stopDragging = (event: PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  };

  const releaseDrag = (event: PointerEvent<HTMLCanvasElement>) => {
    stopDragging(event);
    event.currentTarget.style.cursor = "default";
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <div
      ref={viewportRef}
      className="subscriber-network-viewport relative h-[70vh] min-h-[360px] overflow-hidden rounded-xl border border-[#E4E7EC] bg-[#F9FAFB]"
      onPointerLeave={() => {
        pointerRef.current = null;
        setHoverLabel("");
        if (hoverRef.current) {
          hoverRef.current.active = false;
          hoverRef.current.stoppedAt = performance.now();
        }
      }}
    >
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        aria-label={`Réseau de ${subscribers.length} abonnés et ${layout.groups.length} groupes de liens`}
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        onPointerUp={releaseDrag}
        onPointerCancel={releaseDrag}
        onWheel={handleWheel}
        className="absolute inset-0 z-10 block h-full w-full touch-none"
        style={{
          width: canvasSize.width,
          height: canvasSize.height,
        }}
      />
      {hoverLabel && (
        <div className="pointer-events-none absolute bottom-3 left-3 z-20 w-fit rounded-lg bg-white/95 px-3 py-2 text-xs font-bold text-[#101828] shadow-md">
          {hoverLabel}
        </div>
      )}
    </div>
  );
}

export function SubscriberNetworkGraph({ secteur = "" }: { secteur?: string }) {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    let timedOut = false;
    setLoading(true);
    setError(null);
    const url = apiUrlObject("/subscriber_network");
    if (secteur) url.searchParams.set("secteur", secteur);
    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 60_000);

    fetch(url.toString(), { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Erreur HTTP ${response.status}`);
        const data = await response.json();
        if (!Array.isArray(data)) throw new Error(data?.error || "Réponse invalide du serveur.");
        setSubscribers(data);
      })
      .catch((fetchError: unknown) => {
        if (!active) return;
        if (fetchError instanceof Error && fetchError.name === "AbortError" && !timedOut) return;
        console.error("Erreur lors du chargement du réseau des abonnés :", fetchError);
        setError(timedOut
          ? "Le chargement a dépassé une minute. Vérifiez le backend et réessayez."
          : fetchError instanceof Error ? fetchError.message : "Impossible de charger le réseau des abonnés.");
      })
      .finally(() => {
        window.clearTimeout(timeoutId);
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [secteur]);

  const layout = useMemo(() => createNetworkLayout(subscribers), [subscribers]);

  return (
    <section className="overflow-hidden rounded-2xl border border-[#E4E7EC] bg-white shadow-sm">
      <div className="border-b border-[#F2F4F7] px-5 py-4">
        <h3 className="text-lg font-black text-[#101828]">Réseau des abonnés</h3>
        <p className="mt-1 text-sm text-[#667085]">
          Zoom : commune → tournée → type d’abonné → raison sociale. Zoomez sur une commune pour isoler ses tournées.
        </p>
      </div>
      <div className="space-y-4 p-5">
        {loading ? (
          <div className="flex justify-center p-10" role="status" aria-label="Chargement du réseau">
            <div className="spinner-premium" style={{ width: 32, height: 32 }} />
          </div>
        ) : error ? (
          <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm font-medium text-rose-700">
            Impossible de charger le réseau : {error}
          </p>
        ) : subscribers.length === 0 ? (
          <p className="rounded-xl bg-[#F9FAFB] p-6 text-center text-sm font-medium text-[#667085]">
            Aucun abonné disponible dans ce périmètre.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <p className="font-bold text-[#101828]">
                {subscribers.length.toLocaleString("fr-FR")} abonnés · {layout.groups.length.toLocaleString("fr-FR")} relations partagées
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-[#667085]">
                {RELATION_ORDER.map((relation, index) => (
                  <span key={relation} className="inline-flex items-center gap-1.5">
                    <span
                      className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-black text-white"
                      style={{ backgroundColor: STYLES[relation].color }}
                    >
                      {index + 1}
                    </span>
                    {STYLES[relation].label}
                  </span>
                ))}
              </div>
            </div>
            <NetworkMap key={secteur || "all-authorized"} subscribers={subscribers} layout={layout} />
            <p className="text-xs text-[#667085]">
              Utilisez la molette pour révéler les niveaux, faites glisser les nœuds pour les déplacer et le fond pour vous déplacer dans le graphe. Les liens restent attachés.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
