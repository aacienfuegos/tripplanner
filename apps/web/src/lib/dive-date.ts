import { format, type Locale } from "date-fns";

// 00:00 es el valor por defecto cuando no se conoce la hora (inmersiones
// manuales sin hora, o import de Diving Log sin Entrytime) — se omite en
// vez de mostrar una hora falsa.
export function formatDiveDate(date: Date, locale: Locale): string {
  const time = format(date, "HH:mm");
  return time === "00:00"
    ? format(date, "d MMM yyyy", { locale })
    : format(date, "d MMM yyyy, HH:mm", { locale });
}
