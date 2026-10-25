"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { apiUrlObject } from "../lib/api";

type InstitutionSubscriber = {
  numab: string;
  name: string;
  codinstit: string;
  lib_instit: string;
  commune_name: string;
};

type InstitutionGroup = {
  code: string;
  name: string;
  subscribers: InstitutionSubscriber[];
};

type NetworkPosition = { x: number; y: number };

const PAGE_SIZE = 16;
const VIEW_WIDTH = 900;
const VIEW_HEIGHT = 600;
const CENTER_POSITION: NetworkPosition = { x: VIEW_WIDTH / 2, y: VIEW_HEIGHT / 2 };
const NODE_RADIUS = 205;
const SUBSCRIBER_COLLISION_DISTANCE = 64;
const INSTITUTION_COLLISION_DISTANCE = 102;

function createInitialPositions(subscribers: InstitutionSubscriber[]) {
  const positions: Record<string, NetworkPosition> = {
    institution: CENTER_POSITION,
  };
  subscribers.forEach((subscriber, index) => {
    const angle = (2 * Math.PI * index) / subscribers.length - Math.PI / 2;
    positions[subscriber.numab] = {
      x: CENTER_POSITION.x + NODE_RADIUS * Math.cos(angle),
      y: CENTER_POSITION.y + NODE_RADIUS * Math.sin(angle),
    };
  });
  return positions;
}

function InstitutionNetworkMap({
  institution,
  subscribers,
}: {
  institution: InstitutionGroup;
  subscribers: InstitutionSubscriber[];
}) {
  const [positions, setPositions] = useState(() => createInitialPositions(subscribers));
  const positionsRef = useRef(positions);
  const anchorsRef = useRef(positions);
  const dragRef = useRef<{ nodeId: string; pointerId: number } | null>(null);
  const hoverRef = useRef<{
    origin: NetworkPosition;
    startedAt: number;
    active: boolean;
    stoppedAt?: number;
  } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const getPosition = (nodeId: string) => positions[nodeId] ?? CENTER_POSITION;

  useEffect(() => {
    let frameId = 0;
    let lastFrameTime = 0;
    const velocities: Record<string, NetworkPosition> = {};
    const nodeIds = ["institution", ...subscribers.map((subscriber) => subscriber.numab)];
    nodeIds.forEach((id) => {
      velocities[id] = { x: 0, y: 0 };
    });

    const animate = (time: number) => {
      frameId = window.requestAnimationFrame(animate);
      if (time - lastFrameTime < 16) return;
      const elapsed = time / 1000;
      const centerAnchor = anchorsRef.current.institution ?? CENTER_POSITION;
      const currentCenter = positionsRef.current.institution ?? CENTER_POSITION;
      const nextPositions = { ...positionsRef.current };
      const hover = hoverRef.current;
      if (hover && !hover.active && hover.stoppedAt && time - hover.stoppedAt > 1800) {
        hoverRef.current = null;
      }
      const waveElapsed = hover
        ? Math.max(0, ((hover.active ? time : hover.stoppedAt ?? time) - hover.startedAt) / 1000)
        : 10;
      const waveOrigin = hover?.origin ?? null;
      const waveOffset = (id: string, anchor: NetworkPosition) => {
        if (!waveOrigin || waveElapsed > 1.8) return { x: 0, y: 0 };
        const dx = anchor.x - waveOrigin.x;
        const dy = anchor.y - waveOrigin.y;
        const distance = Math.hypot(dx, dy);
        const direction = distance > 0 ? { x: dx / distance, y: dy / distance } : { x: 0, y: 0 };
        const phase = waveElapsed * 11 - distance / 24;
        const amplitude = Math.sin(phase) * Math.exp(-waveElapsed * 1.9) * 11;
        return { x: direction.x * amplitude, y: direction.y * amplitude };
      };
      const centerPhase = institution.code.length;
      const centerWave = waveOffset("institution", centerAnchor);
      nextPositions.institution = {
        x: centerAnchor.x + Math.sin(elapsed * 0.7 + centerPhase) * 3 + centerWave.x,
        y: centerAnchor.y + Math.cos(elapsed * 0.55 + centerPhase) * 3 + centerWave.y,
      };

      for (const [index, subscriber] of subscribers.entries()) {
        const id = subscriber.numab;
        const anchor = anchorsRef.current[id];
        if (!anchor) continue;
        const phase = index * 2.17 + subscriber.numab.length;
        const wave = waveOffset(id, anchor);
        const targetX = anchor.x + (currentCenter.x - centerAnchor.x) + Math.sin(elapsed * 0.65 + phase) * 7 + wave.x;
        const targetY = anchor.y + (currentCenter.y - centerAnchor.y) + Math.cos(elapsed * 0.8 + phase) * 7 + wave.y;
        const current = positionsRef.current[id] ?? anchor;
        const velocity = velocities[id];
        velocity.x = (velocity.x + (targetX - current.x) * 0.018) * 0.905;
        velocity.y = (velocity.y + (targetY - current.y) * 0.018) * 0.905;
        nextPositions[id] = {
          x: Math.max(35, Math.min(VIEW_WIDTH - 35, current.x + velocity.x)),
          y: Math.max(35, Math.min(VIEW_HEIGHT - 35, current.y + velocity.y)),
        };
      }

      const movableIds = subscribers.map((subscriber) => subscriber.numab);
      for (let pass = 0; pass < 3; pass += 1) {
        for (let firstIndex = -1; firstIndex < movableIds.length; firstIndex += 1) {
          const firstId = firstIndex < 0 ? "institution" : movableIds[firstIndex];
          for (let secondIndex = firstIndex + 1; secondIndex < movableIds.length; secondIndex += 1) {
            const secondId = movableIds[secondIndex];
            const first = nextPositions[firstId];
            const second = nextPositions[secondId];
            const dx = second.x - first.x;
            const dy = second.y - first.y;
            const distance = Math.hypot(dx, dy);
            const minimumDistance = firstId === "institution"
              ? INSTITUTION_COLLISION_DISTANCE
              : SUBSCRIBER_COLLISION_DISTANCE;
            if (distance >= minimumDistance) continue;

            const angle = distance > 0 ? Math.atan2(dy, dx) : (firstIndex + secondIndex + 1) * 2.4;
            const separation = minimumDistance - distance;
            const firstShift = firstId === "institution" ? 0 : separation / 2;
            const secondShift = firstId === "institution" ? separation : separation / 2;
            const firstNext = {
              x: first.x - Math.cos(angle) * firstShift,
              y: first.y - Math.sin(angle) * firstShift,
            };
            const secondNext = {
              x: second.x + Math.cos(angle) * secondShift,
              y: second.y + Math.sin(angle) * secondShift,
            };
            if (firstShift) {
              nextPositions[firstId] = firstNext;
              velocities[firstId].x += (firstNext.x - first.x) * 0.5;
              velocities[firstId].y += (firstNext.y - first.y) * 0.5;
            }
            nextPositions[secondId] = secondNext;
            velocities[secondId].x += (secondNext.x - second.x) * 0.5;
            velocities[secondId].y += (secondNext.y - second.y) * 0.5;
          }
        }
      }

      positionsRef.current = nextPositions;
      setPositions(nextPositions);
      lastFrameTime = time;
    };

    frameId = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frameId);
  }, [institution.code, subscribers]);

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    const svg = svgRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !svg) return;

    const bounds = svg.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * VIEW_WIDTH;
    const y = ((event.clientY - bounds.top) / bounds.height) * VIEW_HEIGHT;
    const point = {
      x: Math.max(35, Math.min(VIEW_WIDTH - 35, x)),
      y: Math.max(35, Math.min(VIEW_HEIGHT - 35, y)),
    };
    positionsRef.current = { ...positionsRef.current, [drag.nodeId]: point };
    anchorsRef.current = { ...anchorsRef.current, [drag.nodeId]: point };
    setPositions(positionsRef.current);
  };

  const startDragging = (event: PointerEvent<SVGGElement>, nodeId: string) => {
    event.preventDefault();
    event.stopPropagation();
    dragRef.current = { nodeId, pointerId: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const startHoverWave = (origin: NetworkPosition) => {
    hoverRef.current = { origin, startedAt: performance.now(), active: true };
  };

  const stopHoverWave = () => {
    if (hoverRef.current) {
      hoverRef.current.active = false;
      hoverRef.current.stoppedAt = performance.now();
    }
  };

  const stopDragging = (event: PointerEvent<SVGSVGElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  };

  return (
    <div className="space-y-2">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        role="img"
        aria-label={`Réseau de ${subscribers.length} abonnés liés à ${institution.name}`}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDragging}
        onPointerCancel={stopDragging}
        className="mx-auto block h-auto min-w-[680px] max-w-[900px] touch-none"
      >
        {subscribers.map((subscriber) => {
          const position = getPosition(subscriber.numab);
          const center = getPosition("institution");
          return (
            <g key={`edge-${subscriber.numab}`}>
              <line
                x1={center.x}
                y1={center.y}
                x2={position.x}
                y2={position.y}
                stroke="transparent"
                strokeWidth="14"
                onPointerEnter={() => startHoverWave({
                  x: (center.x + position.x) / 2,
                  y: (center.y + position.y) / 2,
                })}
                onPointerLeave={stopHoverWave}
              />
              <line
                x1={center.x}
                y1={center.y}
                x2={position.x}
                y2={position.y}
                stroke="rgba(var(--color-accent), 0.38)"
                strokeWidth="2"
                pointerEvents="none"
              />
            </g>
          );
        })}
        {(() => {
          const position = getPosition("institution");
          return (
            <g
              onPointerDown={(event) => startDragging(event, "institution")}
              onPointerEnter={() => startHoverWave(getPosition("institution"))}
              onPointerLeave={stopHoverWave}
              className="cursor-grab active:cursor-grabbing"
            >
              <title>Déplacer l’institution et ses liens</title>
              <circle cx={position.x} cy={position.y} r="66" fill="#1d4ed8" />
              <text
                x={position.x}
                y={position.y + 5}
                textAnchor="middle"
                fill="white"
                fontSize="14"
                fontWeight="700"
                pointerEvents="none"
              >
                {institution.name.length > 18
                  ? `${institution.name.slice(0, 16)}…`
                  : institution.name}
              </text>
            </g>
          );
        })()}
        {subscribers.map((subscriber) => {
          const position = getPosition(subscriber.numab);
          return (
            <g
              key={subscriber.numab}
              onPointerDown={(event) => startDragging(event, subscriber.numab)}
              onPointerEnter={() => startHoverWave(getPosition(subscriber.numab))}
              onPointerLeave={stopHoverWave}
              className="cursor-grab active:cursor-grabbing"
            >
              <title>{`${subscriber.name} · ${subscriber.numab} — glisser pour déplacer`}</title>
              <circle cx={position.x} cy={position.y} r="30" fill="#eff6ff" stroke="#4f46e5" strokeWidth="2" />
              <text
                x={position.x}
                y={position.y + 3}
                textAnchor="middle"
                fill="#101828"
                fontSize="9"
                fontWeight="700"
                pointerEvents="none"
              >
                {subscriber.numab.length > 12 ? `${subscriber.numab.slice(0, 11)}…` : subscriber.numab}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#667085]">
        <p>Glissez les nœuds pour les déplacer : les liens restent attachés.</p>
        <button
          type="button"
          onClick={() => {
            const initial = createInitialPositions(subscribers);
            positionsRef.current = initial;
            anchorsRef.current = initial;
            setPositions(initial);
          }}
          className="rounded-lg border border-[#D0D5DD] px-3 py-1.5 font-bold text-brand-700 transition-colors hover:bg-brand-50"
        >
          Réinitialiser le graphe
        </button>
      </div>
    </div>
  );
}

export function SubscriberNetworkGraph({ secteur = "" }: { secteur?: string }) {
  const [records, setRecords] = useState<InstitutionSubscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [institutionQuery, setInstitutionQuery] = useState("");
  const [selectedCode, setSelectedCode] = useState("");
  const [page, setPage] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    const url = apiUrlObject("/institution_subscribers");
    if (secteur) url.searchParams.set("secteur", secteur);

    fetch(url.toString(), { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Erreur HTTP ${response.status}`);
        const data = await response.json();
        if (!Array.isArray(data)) {
          throw new Error(data?.error || "Réponse invalide du serveur.");
        }
        setRecords(data);
      })
      .catch((fetchError: unknown) => {
        if (fetchError instanceof Error && fetchError.name === "AbortError") return;
        console.error("Erreur lors du chargement du réseau des abonnés :", fetchError);
        setError(fetchError instanceof Error
          ? fetchError.message
          : "Impossible de charger les liens entre abonnés.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [secteur]);

  const institutions = useMemo(() => {
    const groups = new Map<string, { code: string; name: string; subscribers: Map<string, InstitutionSubscriber> }>();
    for (const record of records) {
      const code = String(record.codinstit ?? "").trim();
      const numab = String(record.numab ?? "").trim();
      if (!code || !numab) continue;

      let group = groups.get(code);
      if (!group) {
        group = {
          code,
          name: String(record.lib_instit ?? "").trim() || code,
          subscribers: new Map(),
        };
        groups.set(code, group);
      }
      group.subscribers.set(numab, record);
    }

    return [...groups.values()]
      .map((group): InstitutionGroup => ({
        code: group.code,
        name: group.name,
        subscribers: [...group.subscribers.values()].sort((left, right) => left.numab.localeCompare(right.numab)),
      }))
      .sort((left, right) => right.subscribers.length - left.subscribers.length || left.name.localeCompare(right.name));
  }, [records]);

  const filteredInstitutions = useMemo(() => {
    const query = institutionQuery.trim().toLocaleLowerCase("fr");
    return query
      ? institutions.filter(({ code, name }) => `${name} ${code}`.toLocaleLowerCase("fr").includes(query))
      : institutions;
  }, [institutions, institutionQuery]);

  useEffect(() => {
    if (!filteredInstitutions.some((institution) => institution.code === selectedCode)) {
      setSelectedCode(filteredInstitutions[0]?.code ?? "");
      setPage(0);
    }
  }, [filteredInstitutions, selectedCode]);

  const selectedInstitution = institutions.find(({ code }) => code === selectedCode);
  const pageCount = selectedInstitution
    ? Math.ceil(selectedInstitution.subscribers.length / PAGE_SIZE)
    : 0;
  const visibleSubscribers = selectedInstitution
    ? selectedInstitution.subscribers.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
    : [];
  return (
    <section className="overflow-hidden rounded-2xl border border-[#E4E7EC] bg-white shadow-sm">
      <div className="border-b border-[#F2F4F7] px-5 py-4">
        <h3 className="text-lg font-black text-[#101828]">Réseau des abonnés</h3>
        <p className="mt-1 text-sm text-[#667085]">
          Les abonnés reliés à une même institution sont regroupés autour de son nœud.
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
        ) : institutions.length === 0 ? (
          <p className="rounded-xl bg-[#F9FAFB] p-6 text-center text-sm font-medium text-[#667085]">
            Aucun lien institutionnel disponible pour ce périmètre.
          </p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
              <label className="text-xs font-bold text-[#475467]">
                Rechercher une institution
                <input
                  type="search"
                  value={institutionQuery}
                  onChange={(event) => setInstitutionQuery(event.target.value)}
                  placeholder="Nom ou code"
                  className="mt-1.5 w-full rounded-lg border border-[#D0D5DD] px-3 py-2 text-sm font-medium text-[#101828] outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15"
                />
              </label>
              <label className="text-xs font-bold text-[#475467]">
                Institution — {filteredInstitutions.length} résultat{filteredInstitutions.length === 1 ? "" : "s"}
                <select
                  value={selectedCode}
                  onChange={(event) => {
                    setSelectedCode(event.target.value);
                    setPage(0);
                  }}
                  className="mt-1.5 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-sm font-medium text-[#101828] outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15"
                >
                  {filteredInstitutions.map((institution) => (
                    <option key={institution.code} value={institution.code}>
                      {institution.name} · {institution.subscribers.length} abonné{institution.subscribers.length === 1 ? "" : "s"}
                    </option>
                  ))}
                  {filteredInstitutions.length === 0 && <option value="">Aucune institution trouvée</option>}
                </select>
              </label>
            </div>

            {selectedInstitution && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <p className="font-bold text-[#101828]">
                    {selectedInstitution.name}
                    <span className="ml-2 font-medium text-[#667085]">({selectedInstitution.code})</span>
                  </p>
                  <p className="text-[#667085]">
                    {selectedInstitution.subscribers.length.toLocaleString("fr-FR")} abonné{selectedInstitution.subscribers.length === 1 ? "" : "s"} liés
                  </p>
                </div>

                <div className="overflow-x-auto rounded-xl border border-[#E4E7EC] bg-[#F9FAFB]">
                  <InstitutionNetworkMap
                    key={`${selectedInstitution.code}-${page}`}
                    institution={selectedInstitution}
                    subscribers={visibleSubscribers}
                  />
                </div>

                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4" aria-label="Abonnés affichés dans le réseau">
                  {visibleSubscribers.map((subscriber) => (
                    <div key={subscriber.numab} className="min-w-0 rounded-lg border border-[#E4E7EC] px-3 py-2">
                      <p className="truncate text-xs font-bold text-[#101828]" title={subscriber.name}>{subscriber.name}</p>
                      <p className="mt-0.5 text-[11px] text-[#667085]">
                        {subscriber.numab}{subscriber.commune_name ? ` · ${subscriber.commune_name}` : ""}
                      </p>
                    </div>
                  ))}
                </div>

                {pageCount > 1 && (
                  <div className="flex items-center justify-center gap-3">
                    <button
                      type="button"
                      disabled={page === 0}
                      onClick={() => setPage((current) => current - 1)}
                      className="rounded-lg border border-[#D0D5DD] px-3 py-1.5 text-sm font-bold text-brand-700 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Précédent
                    </button>
                    <span className="text-xs font-medium text-[#667085]">
                      Page {page + 1} sur {pageCount}
                    </span>
                    <button
                      type="button"
                      disabled={page + 1 >= pageCount}
                      onClick={() => setPage((current) => current + 1)}
                      className="rounded-lg border border-[#D0D5DD] px-3 py-1.5 text-sm font-bold text-brand-700 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Suivant
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}
