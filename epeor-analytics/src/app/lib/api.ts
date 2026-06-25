/**
 * URL de base de l'API.
 * - Navigateur sans NEXT_PUBLIC_API_URL : proxy same-origin `/backend-api` (LAN + Internet)
 * - Serveur Next (rewrites) : BACKEND_URL (défini dans .env.local ou l'environnement)
 */
export function getApiBase(): string {
  const trim = (s: string) => s.replace(/\/$/, "");

  if (typeof window !== "undefined") {
    const publicUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
    if (publicUrl) return trim(publicUrl);
    return "/backend-api";
  }

  const serverUrl =
    process.env.NEXT_PUBLIC_API_URL?.trim() ||
    process.env.BACKEND_URL?.trim() ||
    "http://127.0.0.1:8000"; // valeur par défaut si BACKEND_URL n'est pas défini
  return trim(serverUrl);
}

/** Chemin ou URL absolue vers un endpoint API. */
export function apiUrl(path: string): string {
  const base = getApiBase();
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (base.startsWith("/")) {
    return `${base}${normalized}`;
  }
  return `${base}${normalized}`;
}

/** URL avec searchParams — fonctionne en relatif (/backend-api) et en absolu. */
export function apiUrlObject(path: string): URL {
  const full = apiUrl(path);
  if (/^https?:\/\//i.test(full)) {
    return new URL(full);
  }
  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://127.0.0.1:3000";
  return new URL(full, origin);
}

/** fetch JSON avec gestion d'erreur réseau uniforme. */
export async function fetchJson<T = unknown>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const res = await fetch(apiUrl(path), {
    credentials: "include",
    ...init,
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}
