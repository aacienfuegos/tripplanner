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

// Los clips llegan con instante absoluto (el creation_time del MP4 es UTC), y
// Diving Log guarda hora local sin huso. La incógnita es por tanto el huso del
// sitio de buceo, que a diferencia del reloj de la cámara no cambia porque
// conectes el móvil.
const MIN_SITE_OFFSET_MINUTES = -12 * 60;
const MAX_SITE_OFFSET_MINUTES = 14 * 60;
// Casi todos los husos de buceo son horas enteras. Las medias horas existen
// (India, Sri Lanka) pero son la excepción, así que solo se aceptan si mejoran
// el resultado con holgura: si no, cualquier clip de superficie descuadraría el
// huso media hora para tragarse tres vídeos del barco.
const HALF_HOUR_MARGIN = 1.15;
// Con un solo clip dentro de ventana cualquier huso "encaja"; hacen falta dos
// para que el solapamiento signifique algo.
const MIN_CLIPS_TO_ACCEPT_OFFSET = 2;
// El huso se deduce contra la ventana estricta, sin la tolerancia con la que
// luego se empareja. Con tolerancia, correr el huso media hora casi nunca pierde
// clips y puede ganar los de superficie, así que el máximo se desplaza hacia
// donde haya material grabado antes de entrar al agua.
const DEDUCTION_TOLERANCE_MINUTES = 0;

const MINUTE = 60_000;

// El huso se enseña como se escribe un huso, no como un número de minutos.
export function formatUtcOffset(minutes: number): string {
  const sign = minutes < 0 ? "-" : "+";
  const abs = Math.abs(minutes);
  return `UTC${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}

export function dayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Clave de MediaSiteOffset. Medianoche UTC y no local: un Date de medianoche
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
  const from = Math.min(...timed.map((dive) => diveWallClock(dive))) - (MAX_SITE_OFFSET_MINUTES + toleranceMinutes) * MINUTE;
  const to =
    Math.max(...timed.map((dive) => diveWallClock(dive) + dive.bottomTime * MINUTE)) -
    (MIN_SITE_OFFSET_MINUTES - toleranceMinutes) * MINUTE;
  return clips.filter((clip) => clip.capturedAt.getTime() >= from && clip.capturedAt.getTime() <= to);
}

// Una inmersión sin Entrytime queda a las 00:00 (normalizeEntryTime cae ahí
// cuando el dato falta en Diving Log): no se puede casar por hora.
export function hasUsableTime(dive: MatchableDive): boolean {
  return dive.date.getHours() !== 0 || dive.date.getMinutes() !== 0;
}

// La hora de entrada tal como la escribió Diving Log, anclada a UTC para que no
// dependa del huso del proceso. Se lee con los getters locales porque es así
// como la compuso dive-log-mapper.
function diveWallClock(dive: MatchableDive): number {
  return Date.UTC(
    dive.date.getFullYear(),
    dive.date.getMonth(),
    dive.date.getDate(),
    dive.date.getHours(),
    dive.date.getMinutes(),
    dive.date.getSeconds(),
  );
}

// El instante real en el que empezó la inmersión, una vez sabemos en qué huso
// estaba el ordenador de buceo.
function diveStart(dive: MatchableDive, siteOffsetMinutes: number): number {
  return diveWallClock(dive) - siteOffsetMinutes * MINUTE;
}

function isInsideWindow(
  clip: MatchableClip,
  dive: MatchableDive,
  siteOffsetMinutes: number,
  toleranceMinutes: number,
): boolean {
  const start = diveStart(dive, siteOffsetMinutes) - toleranceMinutes * MINUTE;
  const end = diveStart(dive, siteOffsetMinutes) + (dive.bottomTime + toleranceMinutes) * MINUTE;
  return clip.capturedAt.getTime() >= start && clip.capturedAt.getTime() <= end;
}

function windowCenter(dive: MatchableDive, siteOffsetMinutes: number): number {
  return diveStart(dive, siteOffsetMinutes) + (dive.bottomTime / 2) * MINUTE;
}

// Varios offsets consecutivos meten los mismos clips dentro de la ventana, así
// que el número de aciertos no basta para elegir: se desempata por cuánto se
// centran los clips en la inmersión, que es lo que distingue el desfase real de
// sus vecinos.
function score(
  clips: readonly MatchableClip[],
  dives: readonly MatchableDive[],
  siteOffsetMinutes: number,
  toleranceMinutes: number,
): { matched: number; drift: number } {
  let matched = 0;
  let drift = 0;
  for (const clip of clips) {
    const inside = dives.filter((dive) => isInsideWindow(clip, dive, siteOffsetMinutes, toleranceMinutes));
    if (inside.length === 0) continue;
    matched += 1;
    drift += Math.min(
      ...inside.map((dive) => Math.abs(clip.capturedAt.getTime() - windowCenter(dive, siteOffsetMinutes))),
    );
  }
  return { matched, drift };
}

// `phase` separa los husos en hora entera de los de media hora, para poder
// compararlos entre sí: si la búsqueda de medias horas incluyera también las
// enteras, nunca podría salir peor y el margen no filtraría nada.
function bestOffset(
  clips: readonly MatchableClip[],
  dives: readonly MatchableDive[],
  toleranceMinutes: number,
  phase: 0 | 30,
): { offset: number; matched: number; drift: number } | null {
  let best: { offset: number; matched: number; drift: number } | null = null;
  for (let offset = MIN_SITE_OFFSET_MINUTES + phase; offset <= MAX_SITE_OFFSET_MINUTES; offset += 60) {
    const { matched, drift } = score(clips, dives, offset, toleranceMinutes);
    if (matched === 0) continue;
    const better =
      best === null ||
      matched > best.matched ||
      (matched === best.matched && drift < best.drift);
    if (better) best = { offset, matched, drift };
  }
  return best;
}

// Huso horario en el que estaba el ordenador de buceo durante el viaje. Es lo
// único que falta para situar las inmersiones en tiempo absoluto, porque los
// clips ya vienen en UTC.
export function deduceSiteOffset(
  clips: readonly MatchableClip[],
  dives: readonly MatchableDive[],
  toleranceMinutes = DEDUCTION_TOLERANCE_MINUTES,
): number | null {
  const timed = dives.filter(hasUsableTime);
  if (clips.length === 0 || timed.length === 0) return null;

  const whole = bestOffset(clips, timed, toleranceMinutes, 0);
  const half = bestOffset(clips, timed, toleranceMinutes, 30);
  if (!whole && !half) return null;

  const best =
    whole && (!half || half.matched < whole.matched * HALF_HOUR_MARGIN) ? whole : half!;
  return best.matched >= MIN_CLIPS_TO_ACCEPT_OFFSET ? best.offset : null;
}

export function matchClipsToDive(
  dive: MatchableDive,
  clips: readonly MatchableClip[],
  siteOffsetMinutes: number,
  overrides: ReadonlyMap<string, boolean>,
  toleranceMinutes = DEFAULT_TOLERANCE_MINUTES,
): readonly MatchableClip[] {
  const timed = hasUsableTime(dive);
  return clips.filter((clip) => {
    const override = overrides.get(clip.id);
    if (override !== undefined) return override;
    return timed && isInsideWindow(clip, dive, siteOffsetMinutes, toleranceMinutes);
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
  siteOffsetMinutes: number,
  toleranceMinutes = DEFAULT_TOLERANCE_MINUTES,
): boolean {
  return session.some((clip) => isInsideWindow(clip, dive, siteOffsetMinutes, toleranceMinutes));
}

// El huso es del viaje, no del día: deducirlo día a día dejaba que una jornada
// floja lo descuadrara para tragarse material de superficie, y sobre el logbook
// real eso producía correcciones en dos días de un viaje cuyos otros cuatro no
// las pedían.
const TRIP_GAP_DAYS = 2;

export function groupIntoTrips(days: readonly string[]): readonly (readonly string[])[] {
  const ordered = [...days].sort();
  const trips: string[][] = [];
  for (const day of ordered) {
    const current = trips.at(-1);
    const previous = current?.at(-1);
    const gap = previous
      ? (dayKeyToDate(day).getTime() - dayKeyToDate(previous).getTime()) / 86_400_000
      : Infinity;
    if (gap > TRIP_GAP_DAYS) trips.push([day]);
    else current!.push(day);
  }
  return trips;
}
