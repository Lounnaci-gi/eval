"use client";

import dynamic from "next/dynamic";

const viewLoader = (
  <div className="p-12 flex justify-center">
    <div className="spinner-premium" />
  </div>
);

/** Vues lourdes — code splitting (importées aussi depuis Dashboard.tsx). */
export const GestionAbonnesShell = dynamic(
  () => import("./SubscriberViews").then((m) => ({ default: m.GestionAbonnesShell })),
  { loading: () => viewLoader }
);

export const SubscribersEvolutionView = dynamic(
  () => import("./EvolutionView").then((m) => ({ default: m.SubscribersEvolutionView })),
  { loading: () => viewLoader }
);

export const CreancesAbonnesView = dynamic(
  () => import("./CreancesAbonnesView").then((m) => ({ default: m.CreancesAbonnesView })),
  { loading: () => viewLoader }
);

export const CreancesInstitutionsView = dynamic(
  () => import("./InstitutionsView").then((m) => ({ default: m.CreancesInstitutionsView })),
  { loading: () => viewLoader }
);

export const CreanceDetailView = dynamic(
  () => import("./CreanceViews").then((m) => ({ default: m.CreanceDetailView })),
  { loading: () => viewLoader }
);

export const CreanceVentilationView = dynamic(
  () => import("./ReportsViews").then((m) => ({ default: m.CreanceVentilationView })),
  { loading: () => viewLoader }
);

export const CreanceRepartitionView = dynamic(
  () => import("./ReportsViews").then((m) => ({ default: m.CreanceRepartitionView })),
  { loading: () => viewLoader }
);

export const CreanceCommuneView = dynamic(
  () => import("./ReportsViews").then((m) => ({ default: m.CreanceCommuneView })),
  { loading: () => viewLoader }
);

export const BilanActiviteView = dynamic(
  () => import("./ReportsViews").then((m) => ({ default: m.BilanActiviteView })),
  { loading: () => viewLoader }
);
