/** Base URL du backend FastAPI (port 8000). */
export const API_BASE =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL) ||
  "http://127.0.0.1:8000";

export function apiUrl(path: string): string {
  const base = API_BASE.replace(/\/$/, "");
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}

/** fetch JSON avec gestion d'erreur réseau uniforme. */
export async function fetchJson<T = unknown>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(apiUrl(path), init);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}
