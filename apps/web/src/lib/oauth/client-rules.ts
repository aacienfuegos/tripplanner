// Rules shared by manual clients and CIMD documents.
export const MAX_NAME_LENGTH = 60;
export const MAX_URI_LENGTH = 2048;

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1"]);

// https, or http only on the loopback; no wildcards, fragment or userinfo.
// The URI is stored and compared as written: OAuth 2.1 asks for an exact match.
export function isAllowedRedirectUri(value: string): boolean {
  if (value.length === 0 || value.length > MAX_URI_LENGTH) return false;
  if (value.includes("*") || value.includes("#") || /\s/.test(value)) return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.username || url.password || !url.hostname) return false;
  if (url.protocol === "https:") return true;
  return url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname);
}

export function isLoopbackRedirect(value: string): boolean {
  try {
    return LOOPBACK_HOSTS.has(new URL(value).hostname);
  } catch {
    return false;
  }
}

export function hostOf(value: string): string {
  try {
    return new URL(value).host;
  } catch {
    return "";
  }
}
