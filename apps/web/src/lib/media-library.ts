import "server-only";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";

export type MediaKind = "VIDEO" | "PHOTO";

export type ScannedClip = {
  readonly path: string;
  readonly kind: MediaKind;
  readonly capturedAt: Date;
  readonly sizeBytes: bigint;
};

const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".mkv"]);
const PHOTO_EXTENSIONS = new Set([".jpg", ".jpeg", ".png"]);

// El nombre del fichero es el único timestamp que sobrevive el pipeline de
// sincronización: convertir-120fps.sh recodifica sin -map_metadata ni touch -r,
// así que los ficheros convertidos pierden el creation_time del contenedor y su
// mtime pasa a ser la hora de conversión. El nombre sí se conserva (#311).
const TIMESTAMP = /(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/;

export function parseCapturedAt(filename: string): Date | null {
  const match = TIMESTAMP.exec(filename);
  if (!match) return null;
  const [, year, month, day, hours, minutes, seconds] = match.map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hours > 23 || minutes > 59 || seconds > 59) {
    return null;
  }
  // Hora de pared, igual que dive-log-mapper compone DiveLog.date: ni la cámara
  // ni Diving Log guardan offset, así que el matching es pared contra pared.
  const date = new Date(year, month - 1, day, hours, minutes, seconds);
  return Number.isNaN(date.getTime()) ? null : date;
}

function kindOf(filename: string): MediaKind | null {
  const extension = path.extname(filename).toLowerCase();
  if (VIDEO_EXTENSIONS.has(extension)) return "VIDEO";
  if (PHOTO_EXTENSIONS.has(extension)) return "PHOTO";
  return null;
}

export async function scanMediaLibrary(libraryPath: string): Promise<readonly ScannedClip[]> {
  const entries = await readdir(libraryPath, { withFileTypes: true });
  const clips: ScannedClip[] = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const kind = kindOf(entry.name);
    if (!kind) continue;
    const capturedAt = parseCapturedAt(entry.name);
    if (!capturedAt) continue;
    const { size } = await stat(path.join(libraryPath, entry.name));
    clips.push({ path: entry.name, kind, capturedAt, sizeBytes: BigInt(size) });
  }

  return clips;
}
