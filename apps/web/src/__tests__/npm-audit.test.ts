// @vitest-environment node
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

// Port de scripts/npm-audit.test.ts de paneles: el gate es el mismo blob en los dos repos.

type Entrada = Record<string, unknown>;
type Lock = { readonly packages: Record<string, Entrada> };
type Manifiestos = Record<string, Entrada>;

const RAIZ = resolve(__dirname, "../../../..");
const SCRIPT = join(RAIZ, "scripts/npm-audit.mjs");
const LIMPIO = {
  auditReportVersion: 2,
  vulnerabilities: {},
  metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 } },
};
const HIGH = {
  auditReportVersion: 2,
  vulnerabilities: {
    next: {
      name: "next",
      severity: "high",
      via: [{ name: "next", title: "Prueba", url: "https://github.com/advisories/GHSA-aaaa-bbbb-cccc", severity: "high" }],
    },
  },
  metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 1, critical: 0, total: 1 } },
};

// Sustituye el fetch del gate: sirve manifiestos.json y hace fallar como diga fallo.json la petición de una entrada.
const FETCH_FALSO = `
import { readFileSync } from "node:fs";
const publicados = JSON.parse(readFileSync("manifiestos.json", "utf8"));
const { roto, fallo } = JSON.parse(readFileSync("fallo.json", "utf8"));
globalThis.fetch = async (url) => {
  const { pathname } = new URL(url);
  const i = pathname.lastIndexOf("/");
  const clave = decodeURIComponent(pathname.slice(1, i)) + "@" + pathname.slice(i + 1);
  if (clave === roto && fallo === "red") throw new TypeError("fetch failed");
  if (clave === roto && fallo === "500") return new Response("error", { status: 500 });
  if (clave === roto && fallo === "json") return new Response("{no es json", { status: 200 });
  if (!Object.hasOwn(publicados, clave)) return new Response("not found", { status: 404 });
  return new Response(JSON.stringify(publicados[clave]), { status: 200 });
};
`;

const lockDelRepo = () => JSON.parse(readFileSync(join(RAIZ, "package-lock.json"), "utf8")) as Lock;
const nombre = (clave: string) => clave.slice(clave.lastIndexOf("node_modules/") + "node_modules/".length);

// El manifiesto publicado que corresponde a cada entrada del lockfile del repo, para no depender del registry.
// Como en el registry, las optionalDependencies también van en dependencies: npm las quita de ahí al escribir el lockfile.
function manifiestos(lock: Lock): Manifiestos {
  return Object.fromEntries(
    Object.entries(lock.packages)
      .filter(([clave, e]) => clave.includes("node_modules/") && !e.link)
      .map(([clave, e]) => {
        const manifiesto = {
          name: nombre(clave),
          version: e.version,
          dependencies: { ...(e.dependencies as object), ...(e.optionalDependencies as object) },
          optionalDependencies: e.optionalDependencies,
          peerDependencies: e.peerDependencies,
          scripts: e.hasInstallScript ? { install: "node-gyp rebuild" } : {},
        };
        return [`${nombre(clave)}@${String(e.version)}`, manifiesto];
      }),
  );
}

const dirs: string[] = [];
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

type Opciones = {
  shrinkwrap?: boolean;
  informe?: object;
  publicados?: (m: Manifiestos) => void;
  // Sin --manifests: el gate llama a fetch, sustituido por FETCH_FALSO.
  registry?: { roto?: string; fallo?: "red" | "500" | "json" };
};

function gate(cambiar: (p: Lock["packages"]) => void, opciones: Opciones = {}) {
  const dir = mkdtempSync(join(tmpdir(), "npm-audit-"));
  dirs.push(dir);
  const lock = lockDelRepo();
  const publicados = manifiestos(lock);
  opciones.publicados?.(publicados);
  writeFileSync(join(dir, "manifiestos.json"), JSON.stringify(publicados));
  cambiar(lock.packages);
  writeFileSync(join(dir, "package-lock.json"), JSON.stringify(lock));
  writeFileSync(join(dir, "package.json"), readFileSync(join(RAIZ, "package.json")));
  if (opciones.shrinkwrap) writeFileSync(join(dir, "npm-shrinkwrap.json"), "{}");
  writeFileSync(join(dir, "informe.json"), JSON.stringify(opciones.informe ?? LIMPIO));
  const args = [SCRIPT, "--report", "informe.json"];
  if (opciones.registry) {
    writeFileSync(join(dir, "fetch-falso.mjs"), FETCH_FALSO);
    writeFileSync(join(dir, "fallo.json"), JSON.stringify(opciones.registry));
    args.unshift("--import", pathToFileURL(join(dir, "fetch-falso.mjs")).href);
  } else {
    args.push("--manifests", "manifiestos.json");
  }
  const run = spawnSync(process.execPath, args, { cwd: dir, encoding: "utf8" });
  return { status: run.status, salida: run.stdout + run.stderr };
}

const zod = (p: Lock["packages"]) => p["node_modules/zod"];
const zodPublicado = `zod@${String(zod(lockDelRepo().packages).version)}`;

describe("scripts/npm-audit.mjs", () => {
  it("deja pasar el package-lock.json del repo", () => {
    expect(gate(() => {})).toMatchObject({ status: 0 });
  });

  it("para una advisory high", () => {
    const r = gate(() => {}, { informe: HIGH });
    expect(r.status).toBe(1);
    expect(r.salida).toContain("GHSA-aaaa-bbbb-cccc");
  });

  it.each<[string, (p: Lock["packages"]) => void, string]>([
    ["version subida con el resolved de antes", (p) => Object.assign(zod(p), { version: "4.9.9" }), "resolved"],
    ["otro registry", (p) => Object.assign(zod(p), { resolved: "https://evil.example/zod/-/zod-4.6.7.tgz" }), "resolved"],
    ["integrity que no es sha512", (p) => Object.assign(zod(p), { integrity: "sha1-abc" }), "integrity"],
    ["alias por name", (p) => Object.assign(zod(p), { name: "zod-malo" }), "name zod-malo"],
    ["link fuera de los workspaces", (p) => Object.assign(zod(p), { link: true, resolved: "../../tmp/x" }), "workspace"],
    ["dependencies como array", (p) => Object.assign(zod(p), { dependencies: ["0.0.0"] }), "dependencies no es un objeto"],
    ["dependencies como string", (p) => Object.assign(zod(p), { dependencies: "*" }), "dependencies no es un objeto"],
    ["peerDependencies con un rango que no es string", (p) => Object.assign(zod(p), { peerDependencies: { ms: 2 } }), "peerDependencies no es un objeto"],
  ])("para un lockfile con %s", (_, cambiar, motivo) => {
    const r = gate(cambiar);
    expect(r.status).toBe(1);
    expect(r.salida).toContain(motivo);
  });

  it("para una arista que no está en el manifiesto publicado", () => {
    const r = gate(
      (p) => {
        Object.assign(p["node_modules/ms"], { dependencies: { "core-js": "3.51.0" } });
        p["node_modules/core-js"] = {
          version: "3.51.0",
          resolved: "https://registry.npmjs.org/core-js/-/core-js-3.51.0.tgz",
          integrity: "sha512-AAAA",
          hasInstallScript: true,
        };
      },
      {
        publicados: (m) => {
          m["core-js@3.51.0"] = { name: "core-js", version: "3.51.0", scripts: { postinstall: "node -e 1" } };
        },
      },
    );
    expect(r.status).toBe(1);
    expect(r.salida).toContain("node_modules/ms: dependencies no coincide");
  });

  it("para un rango de optionalDependencies cambiado", () => {
    const r = gate((p) => {
      Object.assign(p["node_modules/vite"], { optionalDependencies: { fsevents: "*" } });
    });
    expect(r.status).toBe(1);
    expect(r.salida).toContain("node_modules/vite: optionalDependencies no coincide");
  });

  it("para hasInstallScript sin script de instalación en el manifiesto", () => {
    const r = gate((p) => Object.assign(zod(p), { hasInstallScript: true }));
    expect(r.status).toBe(1);
    expect(r.salida).toContain("node_modules/zod: hasInstallScript");
  });

  it("acepta una clave en dependencies y optionalDependencies del manifiesto que el lockfile solo tiene en optionalDependencies", () => {
    const { packages } = lockDelRepo();
    const publicados = manifiestos({ packages });
    for (const clave of ["node_modules/pg", "apps/web/node_modules/typescript"]) {
      const e = packages[clave];
      const opcionales = Object.keys(e.optionalDependencies as object);
      expect(opcionales.length).toBeGreaterThan(0);
      expect(opcionales.filter((d) => Object.hasOwn((e.dependencies as object | undefined) ?? {}, d))).toEqual([]);
      const m = publicados[`${nombre(clave)}@${String(e.version)}`];
      expect(Object.keys(m.dependencies as object)).toEqual(expect.arrayContaining(opcionales));
    }
    expect(gate(() => {})).toMatchObject({ status: 0 });
  });

  it("no pide al registry los link a un workspace", () => {
    const links = Object.entries(lockDelRepo().packages).filter(([, e]) => e.link);
    expect(links.length).toBeGreaterThan(0);
    // manifiestos() no trae los link: si el gate los pidiera, fallaría por no encontrarlos.
    expect(gate(() => {})).toMatchObject({ status: 0 });
  });

  it("lee los manifiestos del registry con fetch", () => {
    expect(gate(() => {}, { registry: {} })).toMatchObject({ status: 0 });
  });

  it.each<["red" | "500" | "json", string]>([
    ["red", "no se pudo leer el manifiesto publicado"],
    ["500", "no se pudo leer el manifiesto publicado"],
    ["json", "el registry no devuelve el manifiesto"],
  ])("para si el registry falla con %s", (fallo, motivo) => {
    const r = gate(() => {}, { registry: { roto: zodPublicado, fallo } });
    expect(r.status).toBe(1);
    expect(r.salida).toContain(`node_modules/zod: ${motivo}`);
  });

  it("para si no puede leer un manifiesto publicado", () => {
    const r = gate(() => {}, { publicados: (m) => delete m[zodPublicado] });
    expect(r.status).toBe(1);
    expect(r.salida).toContain("node_modules/zod: no se pudo leer el manifiesto publicado");
  });

  it("para si hay npm-shrinkwrap.json", () => {
    const r = gate(() => {}, { shrinkwrap: true });
    expect(r.status).toBe(1);
    expect(r.salida).toContain("npm-shrinkwrap.json");
  });
});
