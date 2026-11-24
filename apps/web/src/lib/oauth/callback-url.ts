// Where the sign-in page may send the user back: only the authorization
// endpoint, as a relative path. Anything else goes to the dashboard, as before.
// Edge-safe, since auth.config.ts uses it too.
export const DEFAULT_CALLBACK = "/dashboard";
const BASE = "http://callback.invalid";

export function safeCallbackUrl(value: unknown): string {
  if (typeof value !== "string" || value.length > 4096) return DEFAULT_CALLBACK;
  if (!value.startsWith("/oauth/authorize?")) return DEFAULT_CALLBACK;
  if (value.includes("\\") || /[\u0000-\u001f\u007f]/.test(value)) return DEFAULT_CALLBACK;
  let url: URL;
  try {
    url = new URL(value, BASE);
  } catch {
    return DEFAULT_CALLBACK;
  }
  if (url.origin !== BASE || url.pathname !== "/oauth/authorize") return DEFAULT_CALLBACK;
  return url.pathname + url.search;
}
