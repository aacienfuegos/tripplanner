// @vitest-environment node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";
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

// Sustituye el fetch del gate: sirve manifiestos.json y los .tgz de tarballs/, apunta cada URL en peticiones.log y hace
// fallar como diga fallo.json la petición de una entrada (name@version) o de un tarball (su nombre de fichero).
const FETCH_FALSO = `
import { appendFileSync, existsSync, readFileSync } from "node:fs";
const publicados = JSON.parse(readFileSync("manifiestos.json", "utf8"));
const { roto, fallo } = JSON.parse(readFileSync("fallo.json", "utf8"));
globalThis.fetch = async (url) => {
  appendFileSync("peticiones.log", url + "\\n");
  const { pathname } = new URL(url);
  const i = pathname.lastIndexOf("/");
  const tgz = pathname.endsWith(".tgz");
  const clave = tgz ? pathname.slice(i + 1) : decodeURIComponent(pathname.slice(1, i)) + "@" + pathname.slice(i + 1);
  if (clave === roto && fallo === "red") throw new TypeError("fetch failed");
  if (clave === roto && fallo === "500") return new Response("error", { status: 500 });
  if (clave === roto && fallo === "206") return new Response("parcial", { status: 206 });
  if (clave === roto && fallo === "json") return new Response("{no es json", { status: 200 });
  if (tgz) {
    if (!existsSync("tarballs/" + clave)) throw new Error("petición a un .tgz que el test no sirve: " + url);
    return new Response(readFileSync("tarballs/" + clave), { status: 200 });
  }
  if (!Object.hasOwn(publicados, clave)) return new Response("not found", { status: 404 });
  return new Response(JSON.stringify(publicados[clave]), { status: 200 });
};
`;

const lockDelRepo = () => JSON.parse(readFileSync(join(RAIZ, "package-lock.json"), "utf8")) as Lock;
const nombre = (clave: string) => clave.slice(clave.lastIndexOf("node_modules/") + "node_modules/".length);

// El manifiesto publicado que corresponde a cada entrada del lockfile del repo, para no depender del registry.
// Como en el registry, las optionalDependencies también van en dependencies: npm las quita de ahí al escribir el lockfile.
// Y bundleDependencies va como bundledDependencies, que es como lo publica @tailwindcss/oxide-wasm32-wasi.
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
          bundledDependencies: e.bundleDependencies,
          scripts: e.hasInstallScript ? { install: "node-gyp rebuild" } : {},
        };
        return [`${nombre(clave)}@${String(e.version)}`, manifiesto];
      }),
  );
}

const dirs: string[] = [];
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

// El empaquetador del lockfile del repo y una entrada inBundle de prueba debajo de él.
const PADRE = "node_modules/@tailwindcss/oxide-wasm32-wasi";
const TGZ = `oxide-wasm32-wasi-${String(lockDelRepo().packages[PADRE].version)}.tgz`;
const HIJO = `${PADRE}/node_modules/tslib`;
const TSLIB = { version: "2.8.1", dev: true, inBundle: true, license: "0BSD", optional: true };
const conHijo =
  (extra: Entrada = {}, clave = HIJO) =>
  (p: Lock["packages"]) => {
    p[clave] = { ...TSLIB, ...extra };
  };

// Rutas debajo del primer segmento; un enlace es un symlink.
type Miembro = string | { readonly enlace: string };
type Tarball = {
  readonly miembros?: Record<string, Miembro>;
  readonly segmento?: string;
  readonly duplicado?: string;
  // En lugar de un tar.gz.
  readonly bytes?: Buffer;
};
const MIEMBROS: Record<string, Miembro> = {
  "package.json": JSON.stringify({ name: "@tailwindcss/oxide-wasm32-wasi" }),
  "node_modules/tslib/package.json": JSON.stringify({ name: "tslib", version: "2.8.1" }),
};

function empaquetar(dir: string, t: Tarball): Buffer {
  if (t.bytes) return t.bytes;
  const segmento = t.segmento ?? "package";
  const raiz = join(dir, "staging");
  for (const [ruta, m] of Object.entries({ ...MIEMBROS, ...t.miembros })) {
    const destino = join(raiz, segmento, ruta);
    mkdirSync(dirname(destino), { recursive: true });
    if (typeof m === "string") writeFileSync(destino, m);
    else symlinkSync(m.enlace, destino);
  }
  const tar = join(dir, "staging.tar");
  expect(spawnSync("tar", ["-cf", tar, "-C", raiz, "--", segmento]).status).toBe(0);
  // En otra pasada, porque en la misma GNU tar guarda la segunda copia como enlace duro y no como fichero regular.
  if (t.duplicado) expect(spawnSync("tar", ["-rf", tar, "-C", raiz, "--", `${segmento}/${t.duplicado}`]).status).toBe(0);
  return gzipSync(readFileSync(tar));
}

type Opciones = {
  shrinkwrap?: boolean;
  informe?: object;
  publicados?: (m: Manifiestos) => void;
  // Sin --manifests: el gate llama a fetch, sustituido por FETCH_FALSO.
  registry?: { roto?: string; fallo?: "red" | "500" | "206" | "json" };
  // Se sirve como tarball de PADRE, con su integrity en el lockfile antes de cambiar(); implica registry.
  tarball?: Tarball;
  sinTar?: boolean;
};

function gate(cambiar: (p: Lock["packages"]) => void, opciones: Opciones = {}) {
  const dir = mkdtempSync(join(tmpdir(), "npm-audit-"));
  dirs.push(dir);
  const lock = lockDelRepo();
  const publicados = manifiestos(lock);
  opciones.publicados?.(publicados);
  writeFileSync(join(dir, "manifiestos.json"), JSON.stringify(publicados));
  if (opciones.tarball) {
    const bytes = empaquetar(dir, opciones.tarball);
    mkdirSync(join(dir, "tarballs"));
    writeFileSync(join(dir, "tarballs", TGZ), bytes);
    lock.packages[PADRE].integrity = `sha512-${createHash("sha512").update(bytes).digest("base64")}`;
  }
  cambiar(lock.packages);
  writeFileSync(join(dir, "package-lock.json"), JSON.stringify(lock));
  writeFileSync(join(dir, "package.json"), readFileSync(join(RAIZ, "package.json")));
  if (opciones.shrinkwrap) writeFileSync(join(dir, "npm-shrinkwrap.json"), "{}");
  writeFileSync(join(dir, "informe.json"), JSON.stringify(opciones.informe ?? LIMPIO));
  const args = [SCRIPT, "--report", "informe.json"];
  const registry = opciones.registry ?? (opciones.tarball ? {} : undefined);
  if (registry) {
    writeFileSync(join(dir, "fetch-falso.mjs"), FETCH_FALSO);
    writeFileSync(join(dir, "fallo.json"), JSON.stringify(registry));
    args.unshift("--import", pathToFileURL(join(dir, "fetch-falso.mjs")).href);
  } else {
    args.push("--manifests", "manifiestos.json");
  }
  const env = opciones.sinTar ? { ...process.env, PATH: join(dir, "sin-tar") } : process.env;
  const run = spawnSync(process.execPath, args, { cwd: dir, encoding: "utf8", env });
  const log = join(dir, "peticiones.log");
  const peticiones = existsSync(log) ? readFileSync(log, "utf8").split("\n").filter((u) => u !== "") : [];
  return { status: run.status, salida: run.stdout + run.stderr, peticiones };
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

  it("no descarga ningún tarball con el package-lock.json del repo", () => {
    const r = gate(() => {}, { registry: {} });
    expect(r.status).toBe(0);
    expect(r.peticiones.length).toBeGreaterThan(0);
    expect(r.peticiones.filter((u) => u.endsWith(".tgz"))).toEqual([]);
  });

  it("acepta una entrada inBundle que está en el tarball verificado de su padre", () => {
    const r = gate(conHijo(), { tarball: {} });
    expect(r).toMatchObject({ status: 0 });
    expect(r.peticiones).toContain(`https://registry.npmjs.org/@tailwindcss/oxide-wasm32-wasi/-/${TGZ}`);
  });

  it.each<[string, (p: Lock["packages"]) => void, Tarball, string]>([
    ["con resolved", conHijo({ resolved: "https://registry.npmjs.org/tslib/-/tslib-2.8.1.tgz" }), {}, "inBundle con resolved o integrity"],
    ["con integrity", conHijo({ integrity: "sha512-AAAA" }), {}, "inBundle con resolved o integrity"],
    ["con inBundle 1 e integrity", conHijo({ inBundle: 1, integrity: "sha512-AAAA" }), {}, "inBundle con resolved o integrity"],
    ["sin padre", (p) => Object.assign(zod(p), { inBundle: true, resolved: undefined, integrity: undefined }), {}, "sin una entrada padre"],
    ["con un padre que falta", conHijo({}, `${PADRE}/node_modules/nada/node_modules/tslib`), {}, "sin una entrada padre"],
    ["debajo de un link", conHijo({}, "node_modules/@tripplanner/shared/node_modules/tslib"), {}, "no es una entrada del registry"],
    ["debajo de un workspace", conHijo({}, "apps/web/node_modules/tslib"), {}, "su padre apps/web no es una entrada del registry"],
    ["que no está en el tarball", conHijo({}, `${PADRE}/node_modules/left-pad`), {}, "no está en el tarball"],
    ["con otro name en el tarball", conHijo(), { miembros: { "node_modules/tslib/package.json": JSON.stringify({ name: "tslib-malo", version: "2.8.1" }) } }, "no es tslib@2.8.1"],
    ["con otra version que la del tarball", conHijo({ version: "2.8.2" }), {}, "no es tslib@2.8.2"],
    ["con una arista que no está en el tarball", conHijo({ dependencies: { "left-pad": "1.3.0" } }), {}, "dependencies no coincide con el package.json del tarball"],
    ["con hasInstallScript sin script en el tarball", conHijo({ hasInstallScript: true }), {}, "hasInstallScript, pero el package.json del tarball"],
    ["con name que no es el de la clave", conHijo({ name: "tslib-malo" }), {}, "name tslib-malo no coincide con la clave"],
    ["en un tarball cuyo primer segmento empieza por -", conHijo(), { segmento: "-malo" }, "no comparten un primer segmento válido"],
    ["cuyo package.json es un symlink", conHijo(), { miembros: { "node_modules/tslib/package.json": { enlace: "../../package.json" } } }, "no es un único fichero regular"],
    ["cuyo package.json está dos veces", conHijo(), { duplicado: "node_modules/tslib/package.json" }, "no es un único fichero regular"],
  ])("para una entrada inBundle %s", (_, cambiar, tarball, motivo) => {
    const r = gate(cambiar, { tarball });
    expect(r.status).toBe(1);
    expect(r.salida).toContain(motivo);
  });

  it("para un bundleDependencies que no está en el manifiesto publicado", () => {
    const r = gate((p) => Object.assign(zod(p), { bundleDependencies: ["zod-malo"] }));
    expect(r.status).toBe(1);
    expect(r.salida).toContain("node_modules/zod: bundleDependencies no coincide con el manifiesto publicado");
  });

  it("toma bundleDependencies true del manifiesto como todas sus dependencies", () => {
    const padre = lockDelRepo().packages[PADRE];
    expect(Object.keys(padre.dependencies as object).sort()).toEqual([...(padre.bundleDependencies as string[])].sort());
    const publicado = `@tailwindcss/oxide-wasm32-wasi@${String(padre.version)}`;
    const r = gate(() => {}, { publicados: (m) => Object.assign(m[publicado], { bundledDependencies: undefined, bundleDependencies: true }) });
    expect(r).toMatchObject({ status: 0 });
  });

  it.each<[string, Opciones, (p: Lock["packages"]) => void, string]>([
    ["no se descarga", { tarball: {}, registry: { roto: TGZ, fallo: "red" } }, () => {}, "fetch failed"],
    ["da 500", { tarball: {}, registry: { roto: TGZ, fallo: "500" } }, () => {}, "HTTP 500"],
    ["da 206", { tarball: {}, registry: { roto: TGZ, fallo: "206" } }, () => {}, "HTTP 206"],
    ["no cuadra con la integrity", { tarball: {} }, (p) => Object.assign(p[PADRE], { integrity: `sha512-${"A".repeat(86)}==` }), "integrity del tarball"],
    ["no se puede leer", { tarball: { bytes: Buffer.from("no es un tar.gz") } }, () => {}, "tar -tzf sale con"],
    ["necesita tar y no está", { tarball: {}, sinTar: true }, () => {}, "ENOENT"],
  ])("para si el tarball del padre %s", (_, opciones, cambiar, motivo) => {
    const r = gate((p) => {
      conHijo()(p);
      cambiar(p);
    }, opciones);
    expect(r.status).toBe(1);
    expect(r.salida).toContain(`${HIJO}: no se pudo leer el tarball de ${PADRE}`);
    expect(r.salida).toContain(motivo);
  });
});
