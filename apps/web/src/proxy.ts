import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { NextResponse, type NextRequest } from "next/server";

const { auth } = NextAuth(authConfig);

// CSP basada en nonce por request: next-themes inyecta un <script> inline
// para fijar el tema antes de la hidratación (ver ThemeProvider), y Next.js
// lee el nonce del propio header CSP de la request (getScriptNonceFromHeader)
// para aplicarlo automáticamente a sus scripts de hidratación/RSC. maplibre-gl
// 5.x no usa new Function()/eval() para expresiones de estilo (trae su propio
// bundle "-csp-worker"), así que no hace falta 'unsafe-eval'.
function buildCsp(nonce: string) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self'",
    "connect-src 'self' https://tiles.openfreemap.org https://openmaptiles.github.io",
    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
  ].join("; ");
}

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);

  // auth() decide autorización (redirect a /auth/signin) o continúa. Cuando
  // continúa, next-auth llama a NextResponse.next() sin request.headers, así
  // que sus headers NO llegan al render de la página — hay que reconstruir
  // el response nosotros mismos para poder propagar el nonce como header de
  // REQUEST (que es lo que Next.js lee para autofirmar sus scripts).
  const authResponse = (await auth(request as any)) as unknown as Response;

  if (authResponse.headers.get("location")) {
    authResponse.headers.set("Content-Security-Policy", csp);
    return authResponse;
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  for (const cookie of authResponse.headers.getSetCookie()) {
    response.headers.append("set-cookie", cookie);
  }
  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
