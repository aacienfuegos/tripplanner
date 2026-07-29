import type { WebTKeys } from "@/i18n";

export const DIVE_TYPE_KEYS = [
  "RECREATIONAL",
  "TRAINING",
  "NIGHT",
  "WRECK",
  "DRIFT",
  "DEEP",
  "CAVE",
  "FREEDIVE",
] as const;

export type DiveTypeKey = (typeof DIVE_TYPE_KEYS)[number];

export function diveTypeKeyLabels(t: WebTKeys): Record<DiveTypeKey, string> {
  return {
    RECREATIONAL: t.diveTypeRecreational,
    TRAINING: t.diveTypeTraining,
    NIGHT: t.diveTypeNight,
    WRECK: t.diveTypeWreck,
    DRIFT: t.diveTypeDrift,
    DEEP: t.diveTypeDeep,
    CAVE: t.diveTypeCave,
    FREEDIVE: t.diveTypeFreedive,
  };
}

export function isDiveTypeKey(value: string | null | undefined): value is DiveTypeKey {
  return !!value && (DIVE_TYPE_KEYS as readonly string[]).includes(value);
}

// diveType es texto libre en el schema (el import de Diving Log trae valores
// arbitrarios que no encajan en una lista cerrada) — solo se traduce cuando
// coincide con una de nuestras claves conocidas; en cualquier otro caso
// (texto propio del usuario o importado) se muestra tal cual se guardó.
export function diveTypeLabel(value: string | null | undefined, t: WebTKeys): string | undefined {
  if (!value) return undefined;
  return isDiveTypeKey(value) ? diveTypeKeyLabels(t)[value] : value;
}
