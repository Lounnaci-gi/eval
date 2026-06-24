"use client";

import dynamic from "next/dynamic";

const viewLoader = (
  <div className="p-12 flex justify-center">
    <div className="w-8 h-8 border-4 border-brand-100 border-t-brand-600 rounded-full animate-spin" />
  </div>
);

/** Vues lourdes chargées à la demande (code splitting). */
export const SubscribersEvolutionView = dynamic(
  () => import("./EvolutionView").then((mod) => ({ default: mod.SubscribersEvolutionView })),
  { loading: () => viewLoader }
);

export const LazySettingsView = dynamic(
  () => import("./SettingsView").then((mod) => ({ default: mod.SettingsView })),
  { loading: () => viewLoader }
);
