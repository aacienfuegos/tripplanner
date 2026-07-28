import type { NextConfig } from "next";

// La Content-Security-Policy va en src/proxy.ts: necesita un nonce distinto
// por request para los scripts inline (p.ej. el de next-themes), algo que
// las cabeceras estáticas de next.config no pueden generar.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Sin "preload": añadirlo requiere confirmar que TODOS los subdominios
  // sirven HTTPS de forma permanente antes de entrar en la lista de
  // precarga de los navegadores (revertir es lento). max-age de 2 años.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
