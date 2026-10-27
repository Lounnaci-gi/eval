"use client";

import { useEffect, useMemo, useState } from "react";
import { apiUrlObject } from "../lib/api";
import { SubscriberNetworkScene3D, type NetworkSubscriber } from "./SubscriberNetworkScene3D";

export function SubscriberNetworkGraph({ secteur = "" }: { secteur?: string }) {
  const [subscribers, setSubscribers] = useState<NetworkSubscriber[]>([]);
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

    fetch(url.toString(), { credentials: "include", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Erreur HTTP ${response.status}`);
        const data = await response.json();
        if (!Array.isArray(data)) throw new Error(data?.error || "Réponse invalide du serveur.");
        if (active) setSubscribers(data as NetworkSubscriber[]);
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

  const groupCounts = useMemo(() => {
    const communes = new Set<string>();
    const tournees = new Set<string>();
    const types = new Set<string>();
    for (const subscriber of subscribers) {
      const commune = (subscriber.codcom || subscriber.commune || "inconnue").trim().toLocaleLowerCase("fr");
      const tournee = (subscriber.tournee || "sans tournée").trim().toLocaleLowerCase("fr");
      const type = (subscriber.typabon || subscriber.type_abonne || "inconnu").trim().toLocaleLowerCase("fr");
      communes.add(commune);
      tournees.add(`${commune}:${tournee}`);
      types.add(`${commune}:${tournee}:${type}`);
    }
    return { communes: communes.size, tournees: tournees.size, types: types.size };
  }, [subscribers]);

  return (
    <section className="overflow-hidden rounded-2xl border border-[#E4E7EC] bg-white shadow-sm">
      <div className="border-b border-[#F2F4F7] px-5 py-4">
        <h3 className="text-lg font-black text-[#101828]">Amas globulaire des abonnés</h3>
        <p className="mt-1 text-sm text-[#667085]">
          Explorez l’espace des données : communes, tournées, types d’abonnés puis abonnés individuels.
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
                {subscribers.length.toLocaleString("fr-FR")} abonnés · {groupCounts.communes} communes · {groupCounts.tournees} tournées · {groupCounts.types} types
              </p>
              <p className="text-xs text-[#667085]">Compteurs et factures affichés au niveau individuel.</p>
            </div>
            <SubscriberNetworkScene3D key={secteur || "all-authorized"} subscribers={subscribers} />
          </>
        )}
      </div>
    </section>
  );
}
