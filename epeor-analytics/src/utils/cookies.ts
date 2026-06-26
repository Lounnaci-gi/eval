export function buildSetCookieRefresh(token: string, maxAgeDays = 30) {
  const expires = new Date(Date.now() + maxAgeDays * 24 * 60 * 60 * 1000).toUTCString();
  return `refresh_token=${encodeURIComponent(token)}; Path=/; Expires=${expires}; HttpOnly; Secure; SameSite=Strict;`;
}

export function buildClearRefreshCookie() {
  return `refresh_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Strict;`;
}

export function buildSetCsrfCookie(token: string, maxAgeDays = 30) {
  const expires = new Date(Date.now() + maxAgeDays * 24 * 60 * 60 * 1000).toUTCString();
  // csrf cookie is purposefully NOT HttpOnly so client JS can read it and send header
  return `csrf_token=${encodeURIComponent(token)}; Path=/; Expires=${expires}; Secure; SameSite=Strict;`;
}

export function buildClearCsrfCookie() {
  return `csrf_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; SameSite=Strict;`;
}
