// npm audit no admite excepciones: este gate las aplica por GHSA y paquete, con caducidad, y falla cerrado ante un lockfile o un informe que no reconoce.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

const SEVERITIES = ["info", "low", "moderate", "high", "critical"];
const BLOCKING = ["high", "critical"];
const GHSA = /\/(GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4})$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const NPM_NAME = /^(?:@[a-z0-9][a-z0-9._~-]*\/)?[a-zA-Z0-9][a-zA-Z0-9._~-]*$/;
const MAX_DAYS = 90;
const REGISTRY = "https://registry.npmjs.org";
const INSTALL_SCRIPTS = ["preinstall", "install", "postinstall"];
const EDGES = ["dependencies", "optionalDependencies", "peerDependencies"];
const CONCURRENCY = 16;
const MAX_BUFFER = 64 * 1024 * 1024;
const TAR_SEGMENT = /^[A-Za-z0-9._][A-Za-z0-9._-]*$/;

const today = new Date().toISOString().slice(0, 10);
const maxExpires = new Date(Date.now() + MAX_DAYS * 86400000).toISOString().slice(0, 10);

function fail(title, details) {
  console.error([title, ...details.map((d) => `  ${d}`)].join("\n"));
  process.exit(1);
}

const isObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
const parseJson = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

function loadExceptions() {
  const file = new URL("./audit-exceptions.json", import.meta.url);
  const exceptions = parseJson(readFileSync(file, "utf8"));
  if (!Array.isArray(exceptions)) fail("excepciones inválidas", ["audit-exceptions.json no es un array"]);
  const problems = exceptions.flatMap((e, i) => {
    if (!isObject(e)) return [`entrada ${i}: no es un objeto`];
    const missing = ["id", "package", "reason"].filter((k) => typeof e[k] !== "string" || e[k] === "");
    if (missing.length > 0) return [`entrada ${i}: falta ${missing.join(", ")}`];
    const label = `${e.id} en ${e.package}`;
    if (typeof e.expires !== "string" || !DATE.test(e.expires)) return [`${label}: expires no es YYYY-MM-DD`];
    if (e.expires > maxExpires) return [`${label}: expires ${e.expires} pasa del tope de ${MAX_DAYS} días (${maxExpires})`];
    return [];
  });
  if (problems.length > 0) fail("excepciones inválidas", problems);
  return exceptions;
}

const depMap = (v) => (isObject(v) ? v : {});
const sameDeps = (a, b) =>
  Object.keys(a).length === Object.keys(b).length && Object.keys(a).every((k) => Object.hasOwn(b, k) && a[k] === b[k]);

async function download(url) {
  let reason = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (res.status === 200) return Buffer.from(await res.arrayBuffer());
      reason = `HTTP ${res.status}`;
      if (res.status < 500 && res.status !== 429) break;
    } catch (e) {
      reason = e instanceof Error ? e.message : String(e);
    }
  }
  throw new Error(`${url}: ${reason}`);
}

const fetchManifest = async (name, version) =>
  parseJson((await download(`${REGISTRY}/${name.replace("/", "%2F")}/${version}`)).toString("utf8"));

// Como @npmcli/package-json: bundledDependencies si falta bundleDependencies; true son las claves de dependencies.
function bundleNames(manifest) {
  const bd = manifest.bundleDependencies === undefined ? manifest.bundledDependencies : manifest.bundleDependencies;
  if (bd === true) return Object.keys(depMap(manifest.dependencies));
  if (Array.isArray(bd)) return bd;
  return isObject(bd) ? Object.keys(bd) : [];
}
const sameSet = (a, b) => new Set(a).size === new Set(b).size && a.every((x) => b.includes(x));

function edgeProblems({ key, name, entry }, manifest, source = "el manifiesto publicado") {
  const label = `${name}@${entry.version}`;
  if (!isObject(manifest) || manifest.name !== name || manifest.version !== entry.version) {
    return [`${key}: el registry no devuelve el manifiesto de ${label}`];
  }
  // npm quita de dependencies las que también están en optionalDependencies al escribir el lockfile.
  const optional = depMap(manifest.optionalDependencies);
  const expected = {
    dependencies: Object.fromEntries(Object.entries(depMap(manifest.dependencies)).filter(([d]) => !Object.hasOwn(optional, d))),
    optionalDependencies: optional,
    peerDependencies: depMap(manifest.peerDependencies),
  };
  const wrong = EDGES.filter((field) => !sameDeps(depMap(entry[field]), expected[field]));
  if (wrong.length > 0) return [`${key}: ${wrong.join(", ")} no coincide con ${source} de ${label}`];
  // Si no, el lockfile podría convertir en empaquetador a un paquete que no lo es.
  if (!sameSet(entry.bundleDependencies ?? [], bundleNames(manifest))) {
    return [`${key}: bundleDependencies no coincide con ${source} de ${label}`];
  }
  const scripts = depMap(manifest.scripts);
  if (entry.hasInstallScript && manifest.hasInstallScript !== true && !INSTALL_SCRIPTS.some((s) => Object.hasOwn(scripts, s))) {
    return [`${key}: hasInstallScript, pero ${source} de ${label} no tiene ${INSTALL_SCRIPTS.join(", ")}`];
  }
  return [];
}

// npm ci monta el árbol con las aristas del lockfile, no con el package.json del tarball: se cruzan con el manifiesto
// publicado de cada name@version. Las de la raíz no, porque npm ci ya las compara con package.json.
async function checkEdges(entries) {
  const i = process.argv.indexOf("--manifests");
  const local = i === -1 ? undefined : parseJson(readFileSync(process.argv[i + 1], "utf8"));
  if (i !== -1 && !isObject(local)) fail("manifiestos inválidos", ["--manifests no es un objeto JSON"]);
  const manifest = async (name, version) => {
    if (!local) return fetchManifest(name, version);
    if (!Object.hasOwn(local, `${name}@${version}`)) throw new Error(`${name}@${version} no está en --manifests`);
    return local[`${name}@${version}`];
  };
  const queue = [...entries];
  const problems = [];
  const worker = async () => {
    for (let next = queue.shift(); next; next = queue.shift()) {
      try {
        problems.push(...edgeProblems(next, await manifest(next.name, next.entry.version)));
      } catch (e) {
        problems.push(`${next.key}: no se pudo leer el manifiesto publicado (${e instanceof Error ? e.message : String(e)})`);
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  if (problems.length > 0) fail("lockfile inesperado", problems.sort());
}

// Arborist saca aristas de un array o un string con Object.entries: si no, checkEdges los compararía como vacíos.
function shapeProblems(key, entry) {
  const malformed = EDGES.filter(
    (f) => Object.hasOwn(entry, f) && !(isObject(entry[f]) && Object.values(entry[f]).every((r) => typeof r === "string")),
  );
  if (malformed.length > 0) return [`${key}: ${malformed.join(", ")} no es un objeto de nombre y rango`];
  const bd = entry.bundleDependencies;
  if (bd !== undefined && !(Array.isArray(bd) && bd.every((d) => typeof d === "string"))) {
    return [`${key}: bundleDependencies no es una lista de nombres`];
  }
  return [];
}

// El empaquetador de una entrada inBundle es la entrada más cercana de su clave que no es inBundle.
function bundlerOf(packages, key) {
  for (let at = key.lastIndexOf("/node_modules/"); at > 0; at = key.lastIndexOf("/node_modules/", at - 1)) {
    const parent = packages[key.slice(0, at)];
    if (!isObject(parent)) return undefined;
    if (!parent.inBundle) return key.slice(0, at);
  }
  return undefined;
}

function tar(args, input) {
  const run = spawnSync("tar", args, { input, maxBuffer: MAX_BUFFER });
  if (run.error) throw run.error;
  if (run.status !== 0) throw new Error(`tar ${args[0]} sale con ${run.status ?? run.signal}: ${run.stderr.toString().trim()}`);
  return run.stdout.toString("utf8");
}

// Se lee del stdin de tar, sin escribir nada en disco, y solo después de comprobar la integrity del lockfile.
async function readTarball({ key, entry }) {
  const data = await download(entry.resolved);
  if (`sha512-${createHash("sha512").update(data).digest("base64")}` !== entry.integrity) {
    throw new Error(`la integrity del tarball de ${key} no coincide con el lockfile`);
  }
  const names = tar(["-tzf", "-"], data).split("\n").slice(0, -1);
  const types = tar(["-tvzf", "-"], data).split("\n").slice(0, -1).map((line) => line[0]);
  if (names.length === 0 || names.length !== types.length) throw new Error(`el listado del tarball de ${key} no cuadra`);
  const segments = new Set(names.map((n) => n.split("/")[0]));
  const [segment] = segments;
  if (segments.size !== 1 || !TAR_SEGMENT.test(segment)) {
    throw new Error(`los miembros del tarball de ${key} no comparten un primer segmento válido`);
  }
  return (path) => {
    const member = `${segment}/${path}/package.json`;
    const found = types.filter((_, i) => names[i] === member);
    if (found.length === 0) throw new Error(`${member} no está en el tarball de ${key}`);
    // pacote descarta los Link y SymbolicLink al extraer: solo cuenta un fichero regular, y uno solo.
    if (found.length !== 1 || found[0] !== "-") throw new Error(`${member} no es un único fichero regular en el tarball de ${key}`);
    return parseJson(tar(["-xzOf", "-", "--", member], data));
  };
}

// npm ci monta las entradas inBundle desde el tarball de su padre, cubierto por la integrity del padre; las que no encuentra
// dentro las instala aparte como name@version del registry. Cada una tiene que estar en el tarball y cuadrar con su package.json.
async function checkBundled(entries) {
  const byParent = new Map();
  for (const e of entries) byParent.set(e.parent.key, [...(byParent.get(e.parent.key) ?? []), e]);
  const problems = [];
  for (const group of byParent.values()) {
    const { parent } = group[0];
    let packageJson;
    try {
      packageJson = await readTarball(parent);
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      problems.push(...group.map(({ key }) => `${key}: no se pudo leer el tarball de ${parent.key} (${reason})`));
      continue;
    }
    for (const e of group) problems.push(...bundledProblems(e, packageJson));
  }
  if (problems.length > 0) fail("lockfile inesperado", problems.sort());
}

function bundledProblems(bundledEntry, packageJson) {
  const { key, name, entry, parent, path } = bundledEntry;
  const source = `el package.json del tarball de ${parent.key}`;
  let manifest;
  try {
    manifest = packageJson(path);
  } catch (e) {
    return [`${key}: ${e instanceof Error ? e.message : String(e)}`];
  }
  if (!isObject(manifest) || manifest.name !== name || manifest.version !== entry.version) {
    return [`${key}: ${source} no es ${name}@${entry.version}`];
  }
  return edgeProblems(bundledEntry, manifest, source);
}

async function checkLockfile() {
  if (existsSync("npm-shrinkwrap.json")) {
    fail("lockfile inesperado", ["npm-shrinkwrap.json: npm lo usaría en lugar de package-lock.json"]);
  }
  const lock = existsSync("package-lock.json") ? parseJson(readFileSync("package-lock.json", "utf8")) : undefined;
  if (!isObject(lock)) fail("lockfile inesperado", ["package-lock.json no existe o no es JSON"]);
  if (lock.lockfileVersion !== 3 || !isObject(lock.packages)) {
    fail("lockfile inesperado", ["lockfileVersion no es 3 o packages no es un objeto"]);
  }
  // Los workspaces se leen de package.json y no de packages[""] del lockfile que se está validando.
  const pkg = existsSync("package.json") ? parseJson(readFileSync("package.json", "utf8")) : undefined;
  const workspaces = isObject(pkg) && Array.isArray(pkg.workspaces) ? pkg.workspaces.filter((w) => typeof w === "string") : [];
  const isWorkspace = (dir) =>
    !dir.split("/").some((s) => ["", ".", "..", "node_modules"].includes(s)) &&
    workspaces.some((w) => w === dir || (w.endsWith("/*") && dir.startsWith(w.slice(0, -1)) && !dir.slice(w.length - 1).includes("/")));
  const fromRegistry = [];
  const bundledEntries = [];
  const problems = Object.entries(lock.packages).flatMap(([key, entry]) => {
    if (!key.includes("node_modules/")) return [];
    if (!isObject(entry)) return [`${key}: no es un objeto`];
    const name = key.slice(key.lastIndexOf("node_modules/") + "node_modules/".length);
    // npm trata como link cualquier valor verdadero de link.
    if (entry.link) {
      if (typeof entry.resolved !== "string" || !isWorkspace(entry.resolved)) {
        return [`${key}: link a ${entry.resolved}, que no es un workspace de package.json`];
      }
      const target = lock.packages[entry.resolved];
      // npm solo escribe name en la entrada de un workspace si no coincide con el nombre de su carpeta.
      const folder = entry.resolved.slice(entry.resolved.lastIndexOf("/") + 1);
      const targetName = isObject(target) && ("name" in target ? target.name : folder);
      return targetName === name ? [] : [`${key}: ${entry.resolved} no es el workspace ${name}`];
    }
    // El resolved esperado se construye con estos dos campos: solo vale si version es semver y name un nombre válido de npm.
    if (typeof entry.version !== "string" || !SEMVER.test(entry.version)) return [`${key}: version no es semver`];
    if (!NPM_NAME.test(name)) return [`${key}: la clave no termina en un nombre válido de npm`];
    // npm trata como empaquetada cualquier valor verdadero de inBundle.
    if (entry.inBundle) {
      if ("resolved" in entry || "integrity" in entry) return [`${key}: inBundle con resolved o integrity`];
      if ("name" in entry && entry.name !== name) return [`${key}: name ${entry.name} no coincide con la clave`];
      const shape = shapeProblems(key, entry);
      if (shape.length > 0) return shape;
      const parent = bundlerOf(lock.packages, key);
      if (parent === undefined) return [`${key}: inBundle sin una entrada padre que no sea inBundle`];
      bundledEntries.push({ key, name, entry, parent, path: key.slice(parent.length + 1) });
      return [];
    }
    const base = name.replace(/^@[^/]+\//, "");
    const resolved = `https://registry.npmjs.org/${name}/-/${base}-${entry.version}.tgz`;
    if (typeof entry.integrity !== "string" || !entry.integrity.startsWith("sha512-")) {
      return [`${key}: integrity no es sha512`];
    }
    if ("name" in entry && entry.name !== name) return [`${key}: name ${entry.name} no coincide con la clave`];
    if (entry.resolved !== resolved) return [`${key}: resolved ${entry.resolved} no es ${resolved}`];
    if (new URL(resolved).href !== resolved) return [`${key}: resolved cambia al normalizar la URL`];
    const shape = shapeProblems(key, entry);
    if (shape.length > 0) return shape;
    fromRegistry.push({ key, name, entry });
    return [];
  });
  const registryKeys = new Set(fromRegistry.map((e) => e.key));
  // El padre tiene que ser una entrada del registry: la raíz, un workspace o un link no traen tarball que verificar.
  for (const b of bundledEntries.filter((b) => !registryKeys.has(b.parent))) {
    problems.push(`${b.key}: inBundle, pero su padre ${b.parent} no es una entrada del registry`);
  }
  if (problems.length > 0) fail("lockfile inesperado", problems);
  await checkEdges(fromRegistry);
  const parents = new Map(fromRegistry.map((e) => [e.key, e]));
  await checkBundled(bundledEntries.map((b) => ({ ...b, parent: parents.get(b.parent) })));
}

function loadReport() {
  const i = process.argv.indexOf("--report");
  if (i !== -1) return parseJson(readFileSync(process.argv[i + 1], "utf8"));
  const run = spawnSync("npm", ["audit", "--json"], { encoding: "utf8", maxBuffer: MAX_BUFFER });
  if (run.error) fail("no se pudo auditar", [run.error.message]);
  return parseJson(run.stdout);
}

function parseReport(report) {
  if (!isObject(report)) fail("no se pudo auditar", ["la salida de npm audit no es JSON"]);
  if ("error" in report) fail("no se pudo auditar", [JSON.stringify(report.error)]);
  const counts = isObject(report.metadata) ? report.metadata.vulnerabilities : undefined;
  if (report.auditReportVersion !== 2 || !isObject(counts) || BLOCKING.some((s) => typeof counts[s] !== "number")) {
    fail("no se pudo auditar", ["auditReportVersion no es 2 o metadata.vulnerabilities no trae high y critical"]);
  }
  const vulns = report.vulnerabilities;
  if (!isObject(vulns)) fail("formato inesperado", ["vulnerabilities no es un objeto"]);

  const advisories = new Map();
  const problems = Object.entries(vulns).flatMap(([pkg, entry]) => {
    if (!isObject(entry) || !SEVERITIES.includes(entry.severity) || !Array.isArray(entry.via)) {
      return [`${pkg}: la entrada no trae severity conocida y via[]`];
    }
    return entry.via.flatMap((v) => {
      if (typeof v === "string") return [];
      if (!isObject(v)) return [`${pkg}: via[] trae ${JSON.stringify(v)}`];
      const id = typeof v.url === "string" ? GHSA.exec(v.url)?.[1] : undefined;
      const wrong = [
        typeof v.name === "string" ? "" : "name no es una cadena",
        id ? "" : `url ${JSON.stringify(v.url)} no termina en un GHSA`,
        SEVERITIES.includes(v.severity) ? "" : `severity ${JSON.stringify(v.severity)} desconocida`,
      ].filter((w) => w !== "");
      if (wrong.length > 0) return [`${pkg}: ${wrong.join(", ")}`];
      advisories.set(`${id} ${v.name}`, { id, package: v.name, severity: v.severity, title: v.title });
      return [];
    });
  });
  if (problems.length > 0) fail("formato inesperado", problems);

  const countProblems = BLOCKING.flatMap((s) => {
    const entries = Object.values(vulns).filter((e) => e.severity === s).length;
    return entries === counts[s] ? [] : [`regla (a): metadata.vulnerabilities.${s} = ${counts[s]}, entradas ${s} = ${entries}`];
  });
  if (countProblems.length > 0) fail("formato inesperado", countProblems);

  const reaches = (pkg, seen) => {
    if (!Object.hasOwn(vulns, pkg) || seen.has(pkg)) return false;
    seen.add(pkg);
    return vulns[pkg].via.some((v) => (typeof v === "string" ? reaches(v, seen) : BLOCKING.includes(v.severity)));
  };
  const unexplained = Object.entries(vulns)
    .filter(([pkg, e]) => BLOCKING.includes(e.severity) && !reaches(pkg, new Set()))
    .map(([pkg, e]) => `regla (b): ${pkg} (${e.severity}) no llega a ninguna advisory high o critical`);
  if (unexplained.length > 0) fail("formato inesperado", unexplained);

  return { counts, advisories: [...advisories.values()].filter((a) => BLOCKING.includes(a.severity)) };
}

const exceptions = loadExceptions();
await checkLockfile();
const { counts, advisories } = parseReport(loadReport());

const errors = [];
for (const a of advisories) {
  const e = exceptions.find((x) => x.id === a.id && x.package === a.package);
  if (e && e.expires >= today) {
    console.log(`${a.package} ${a.id} (${a.severity}) exceptuada hasta ${e.expires}: ${e.reason}`);
  } else {
    errors.push(`${a.package} ${a.id} (${a.severity}): ${a.title}`);
  }
}
for (const e of exceptions) {
  if (e.expires < today) {
    errors.push(`excepción caducada el ${e.expires}: ${e.id} en ${e.package}. Revisa si hay versión corregida y renuévala o quítala`);
  } else if (!advisories.some((a) => a.id === e.id && a.package === e.package)) {
    console.log(`aviso: la excepción de ${e.id} en ${e.package} ya no tiene advisory high o critical; se puede quitar`);
  }
}

console.log(`npm audit: ${counts.critical} critical, ${counts.high} high`);
if (errors.length > 0) fail("bloquean el gate:", errors);
