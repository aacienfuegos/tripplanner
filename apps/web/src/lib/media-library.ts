import "server-only";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";

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

export async function scanMediaLibrary(libraryPath: string): Promise<readonly ScannedClip[]> {
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
