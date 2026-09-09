export type MatchableDive = {
  readonly id: string;
  readonly date: Date;
  readonly bottomTime: number;
};

export type MatchableClip = {
  readonly id: string;
  readonly capturedAt: Date;
};

export const DEFAULT_TOLERANCE_MINUTES = 30;

// El reloj de la cámara va por libre y cambia solo, así que el desfase se deduce
// por día. Los offsets reales son diferencias de huso, de ahí el paso de 30 min.
const OFFSET_STEP_MINUTES = 30;
// Un día con varias inmersiones repartidas deja huecos donde un desfase grande
// encaja la ráfaga de la mañana sobre la inmersión de la tarde. Acotar el
// margen es lo que separa el desfase real de esa coincidencia: más allá de tres
// horas la corrección la hace el usuario a mano, que es más barato que un
// emparejamiento silenciosamente equivocado.
const MAX_OFFSET_MINUTES = 3 * 60;
// Con un solo clip dentro de ventana cualquier offset "encaja"; hacen falta dos
// para que el solapamiento signifique algo.
const MIN_CLIPS_TO_ACCEPT_OFFSET = 2;

const MINUTE = 60_000;

export function dayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Clave de DayClockOffset. Medianoche UTC y no local: un Date de medianoche
// local se guarda como las 23:00 del día anterior y la fila deja de ser legible
// fuera de la app.
export function dayKeyToDate(day: string): Date {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date));
}

// Inversa de dayKeyToDate. Lee en UTC a propósito: dayKey() lee la hora local
// porque sus fechas son horas de pared, pero estas están ancladas a medianoche
// UTC y leerlas en local devolvería el día anterior al oeste de Greenwich.
export function dateToDayKey(day: Date): string {
  return day.toISOString().slice(0, 10);
}

// Clips que podrían pertenecer a alguna de estas inmersiones con cualquier
// desfase admisible. Acota el trabajo y, sobre todo, evita que los clips de un
// día vecino entren en la deducción del desfase de este.
export function clipsNearDives(
  clips: readonly MatchableClip[],
  dives: readonly MatchableDive[],
  toleranceMinutes = DEFAULT_TOLERANCE_MINUTES,
): readonly MatchableClip[] {
  const timed = dives.filter(hasUsableTime);
  if (timed.length === 0) return [];
  const margin = (MAX_OFFSET_MINUTES + toleranceMinutes) * MINUTE;
  const from = Math.min(...timed.map((dive) => dive.date.getTime())) - margin;
  const to = Math.max(...timed.map((dive) => dive.date.getTime() + dive.bottomTime * MINUTE)) + margin;
  return clips.filter((clip) => clip.capturedAt.getTime() >= from && clip.capturedAt.getTime() <= to);
}

// Una inmersión sin Entrytime queda a las 00:00 (normalizeEntryTime cae ahí
// cuando el dato falta en Diving Log): no se puede casar por hora.
export function hasUsableTime(dive: MatchableDive): boolean {
  return dive.date.getHours() !== 0 || dive.date.getMinutes() !== 0;
}

function isInsideWindow(
  clip: MatchableClip,
  dive: MatchableDive,
  offsetMinutes: number,
  toleranceMinutes: number,
): boolean {
  const start = dive.date.getTime() - toleranceMinutes * MINUTE;
  const end = dive.date.getTime() + (dive.bottomTime + toleranceMinutes) * MINUTE;
  const corrected = clip.capturedAt.getTime() - offsetMinutes * MINUTE;
  return corrected >= start && corrected <= end;
}

function windowCenter(dive: MatchableDive): number {
  return dive.date.getTime() + (dive.bottomTime / 2) * MINUTE;
}

// Varios offsets consecutivos meten los mismos clips dentro de la ventana, así
// que el número de aciertos no basta para elegir: se desempata por cuánto se
// centran los clips en la inmersión, que es lo que distingue el desfase real de
// sus vecinos.
function score(
  clips: readonly MatchableClip[],
  dives: readonly MatchableDive[],
  offsetMinutes: number,
  toleranceMinutes: number,
): { matched: number; drift: number } {
  let matched = 0;
  let drift = 0;
  for (const clip of clips) {
    const inside = dives.filter((dive) => isInsideWindow(clip, dive, offsetMinutes, toleranceMinutes));
    if (inside.length === 0) continue;
    matched += 1;
    const corrected = clip.capturedAt.getTime() - offsetMinutes * MINUTE;
    drift += Math.min(...inside.map((dive) => Math.abs(corrected - windowCenter(dive))));
  }
  return { matched, drift };
}

export function deduceClockOffset(
  clips: readonly MatchableClip[],
  dives: readonly MatchableDive[],
  toleranceMinutes = DEFAULT_TOLERANCE_MINUTES,
): number | null {
  const timed = dives.filter(hasUsableTime);
  if (clips.length === 0 || timed.length === 0) return null;

  let best: { offset: number; matched: number; drift: number } | null = null;
  for (let offset = -MAX_OFFSET_MINUTES; offset <= MAX_OFFSET_MINUTES; offset += OFFSET_STEP_MINUTES) {
    const { matched, drift } = score(clips, timed, offset, toleranceMinutes);
    const better =
      best === null ||
      matched > best.matched ||
      (matched === best.matched &&
        // A igual centrado, un reloj en hora es más probable que uno desfasado
        // que casa los mismos clips por casualidad.
        (drift < best.drift || (drift === best.drift && Math.abs(offset) < Math.abs(best.offset))));
    if (better) best = { offset, matched, drift };
  }

  if (!best || best.matched < MIN_CLIPS_TO_ACCEPT_OFFSET) return null;
  // Un óptimo pegado al borde del rango explorado no es un óptimo: significa que
  // el desfase real cae fuera y el algoritmo se ha agarrado al último valor que
  // podía probar. Devolver eso emparejaría clips con seguridad injustificada,
  // así que se admite no saberlo y que el usuario ponga el desfase a mano.
  return Math.abs(best.offset) === MAX_OFFSET_MINUTES ? null : best.offset;
}

export function matchClipsToDive(
  dive: MatchableDive,
  clips: readonly MatchableClip[],
  offsetMinutes: number,
  overrides: ReadonlyMap<string, boolean>,
  toleranceMinutes = DEFAULT_TOLERANCE_MINUTES,
): readonly MatchableClip[] {
  const timed = hasUsableTime(dive);
  return clips.filter((clip) => {
    const override = overrides.get(clip.id);
    if (override !== undefined) return override;
    return timed && isInsideWindow(clip, dive, offsetMinutes, toleranceMinutes);
  });
}

// Una cámara de acción no graba de forma uniforme: graba a ráfagas. Agrupando
// por hueco se pasa de cientos de clips sueltos a un puñado de sesiones, que es
// la unidad con la que el usuario razona — y la que se desplaza entera cuando el
// reloj va desfasado, así que es también la unidad que hay que mover a mano.
const SESSION_GAP_MINUTES = 20;

export function groupIntoSessions<T extends MatchableClip>(
  clips: readonly T[],
  gapMinutes = SESSION_GAP_MINUTES,
): readonly (readonly T[])[] {
  const ordered = [...clips].sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime());
  const sessions: T[][] = [];
  for (const clip of ordered) {
    const current = sessions.at(-1);
    const previous = current?.at(-1);
    if (!current || !previous || clip.capturedAt.getTime() - previous.capturedAt.getTime() > gapMinutes * MINUTE) {
      sessions.push([clip]);
    } else {
      current.push(clip);
    }
  }
  return sessions;
}

export function sessionOverlapsDive(
  session: readonly MatchableClip[],
  dive: MatchableDive,
  offsetMinutes: number,
  toleranceMinutes = DEFAULT_TOLERANCE_MINUTES,
): boolean {
  return session.some((clip) => isInsideWindow(clip, dive, offsetMinutes, toleranceMinutes));
}
