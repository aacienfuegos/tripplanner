import "server-only";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

export type MediaKind = "VIDEO" | "PHOTO";

export type ScannedClip = {
  readonly path: string;
  readonly kind: MediaKind;
  // Instante absoluto en el que se grabó, no hora de pared.
  readonly capturedAt: Date;
  readonly sizeBytes: bigint;
};

const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".mkv"]);
const PHOTO_EXTENSIONS = new Set([".jpg", ".jpeg", ".png"]);

const MINUTE = 60_000;
// Los husos reales son múltiplos de 15 minutos. Redondear ahí absorbe los
// segundos de diferencia entre el inicio de la grabación y el cierre del
// fichero sin llegar a confundir dos husos distintos.
const OFFSET_QUANTUM_MINUTES = 15;
// Un huso puede estar hasta 14 horas por delante de UTC.
const MAX_CAMERA_OFFSET_MINUTES = 14 * 60;

const TIMESTAMP = /(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/;

// Hora que marcaba el reloj de la cámara, tal cual, sin interpretarla en ningún
// huso: se devuelve anclada a UTC para que el resultado no dependa de la zona
// horaria del proceso.
export function parseCameraWallClock(filename: string): Date | null {
  const match = TIMESTAMP.exec(filename);
  if (!match) return null;
  const [, year, month, day, hours, minutes, seconds] = match.map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hours > 23 || minutes > 59 || seconds > 59) {
    return null;
  }
  const date = new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds));
  return Number.isNaN(date.getTime()) ? null : date;
}

function kindOf(filename: string): MediaKind | null {
  const extension = path.extname(filename).toLowerCase();
  if (VIDEO_EXTENSIONS.has(extension)) return "VIDEO";
  if (PHOTO_EXTENSIONS.has(extension)) return "PHOTO";
  return null;
}

function dayOf(wallClock: Date): string {
  return wallClock.toISOString().slice(0, 10);
}

// Diferencia entre lo que marcaba el reloj de la cámara y el instante real del
// fichero: el huso que tenía puesto la cámara. Medido sobre la biblioteca real
// sale idéntico para todos los ficheros de un mismo día.
function cameraOffsetOf(wallClock: Date, mtime: Date): number | null {
  const raw = (wallClock.getTime() - mtime.getTime()) / MINUTE;
  if (Math.abs(raw) > MAX_CAMERA_OFFSET_MINUTES) return null;
  return Math.round(raw / OFFSET_QUANTUM_MINUTES) * OFFSET_QUANTUM_MINUTES;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

type Entry = {
  path: string;
  kind: MediaKind;
  wallClock: Date;
  sizeBytes: bigint;
  cameraOffset: number | null;
};

async function scanDirectory(libraryPath: string): Promise<readonly ScannedClip[]> {
  const found = await readdir(libraryPath, { withFileTypes: true });
  const entries: Entry[] = [];

  for (const entry of found) {
    if (!entry.isFile()) continue;
    const kind = kindOf(entry.name);
    if (!kind) continue;
    const wallClock = parseCameraWallClock(entry.name);
    if (!wallClock) continue;
    const { size, mtime } = await stat(path.join(libraryPath, entry.name));
    entries.push({
      path: entry.name,
      kind,
      wallClock,
      sizeBytes: BigInt(size),
      cameraOffset: cameraOffsetOf(wallClock, mtime),
    });
  }

  // El huso se toma por día y por mediana. Un fichero suelto puede traer la
  // fecha estropeada —la recodificación a 60 fps la reescribe—, pero el día
  // entero no, y las fotos ni siquiera guardan UTC: heredan la del día.
  const offsetByDay = new Map<string, number>();
  const samples = new Map<string, number[]>();
  for (const entry of entries) {
    if (entry.cameraOffset === null) continue;
    const day = dayOf(entry.wallClock);
    samples.set(day, [...(samples.get(day) ?? []), entry.cameraOffset]);
  }
  for (const [day, values] of samples) {
    offsetByDay.set(day, Math.round(median(values) / OFFSET_QUANTUM_MINUTES) * OFFSET_QUANTUM_MINUTES);
  }

  return entries.map((entry) => ({
    path: entry.path,
    kind: entry.kind,
    // Sin huso medible se deja la hora de pared tal cual. El emparejamiento
    // sigue funcionando porque el desfase constante que eso introduce lo
    // absorbe el huso del viaje; lo único que se pierde es la inmunidad a que
    // el reloj de la cámara cambie a mitad de viaje.
    capturedAt: new Date(entry.wallClock.getTime() - (offsetByDay.get(dayOf(entry.wallClock)) ?? 0) * MINUTE),
    sizeBytes: entry.sizeBytes,
  }));
}

// En producción la biblioteca no se monta: el mismo script que genera el
// espejo emite un manifiesto con el instante ya resuelto. Evita depender de que
// la fecha de modificación sobreviva a la copia —un `cp` sin `-p` la pone a hoy
// y todos los clips saltan al día de la copia sin que nada falle a la vista— y
// deja a esta app sin acceso de lectura al material.
const manifestSchema = z.object({
  version: z.literal(1),
  generatedAt: z.iso.datetime({ offset: true }),
  // La raíz a la que son relativas las rutas, tal como la ve Jellyfin. Si no
  // coincide con la configurada, los ItemId salen mal y no hay síntoma salvo
  // que ninguna miniatura carga.
  libraryPath: z.string().min(1),
  clips: z
    .array(
      z.object({
        path: z
          .string()
          .min(1)
          .refine(
            (value) => !value.startsWith("/") && !value.split("/").includes(".."),
            "ruta relativa a la raíz de la biblioteca",
          ),
        kind: z.enum(["VIDEO", "PHOTO"]),
        capturedAt: z.iso.datetime({ offset: true }),
        sizeBytes: z.number().int().nonnegative(),
      }),
    )
    .min(1),
});

export class ManifestError extends Error {
  constructor(readonly code: "invalid-manifest" | "library-mismatch") {
    super(code);
  }
}

async function readManifest(
  manifestPath: string,
  jellyfinLibraryPath: string,
): Promise<readonly ScannedClip[]> {
  const parsed = manifestSchema.safeParse(JSON.parse(await readFile(manifestPath, "utf8")));
  if (!parsed.success) throw new ManifestError("invalid-manifest");
  const manifest = parsed.data;
  if (manifest.libraryPath.replace(/\/+$/, "") !== jellyfinLibraryPath.replace(/\/+$/, "")) {
    throw new ManifestError("library-mismatch");
  }
  return manifest.clips.map((clip) => ({
    path: clip.path,
    kind: clip.kind,
    capturedAt: new Date(clip.capturedAt),
    sizeBytes: BigInt(clip.sizeBytes),
  }));
}

// Un directorio se escanea —es el caso local, con la tarjeta de la cámara
// puesta—; un fichero es el manifiesto que genera el servidor.
export async function scanMediaLibrary(
  libraryPath: string,
  jellyfinLibraryPath: string,
): Promise<readonly ScannedClip[]> {
  const info = await stat(libraryPath);
  return info.isDirectory() ? scanDirectory(libraryPath) : readManifest(libraryPath, jellyfinLibraryPath);
}
