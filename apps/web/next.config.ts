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
  // Next 16.3 escribe AGENTS.md/CLAUDE.md en apps/web en cada `next dev`; el
  // AGENTS.md de la raíz del monorepo ya lleva ese mismo texto y CLAUDE.md lo
  // incluye, así que la copia solo ensucia el árbol.
  agentRules: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
  // Por defecto Next.js limita el body de una Server Action a 1MB. El import
  // de Diving Log (dive-import.ts) ya valida hasta 50MB a nivel de aplicación
  // (MAX_FILE_SIZE_BYTES) — sin esto, ese límite nunca se alcanza porque el
  // framework corta la petición antes de que la action llegue a ejecutarse.
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
};

export default nextConfig;
