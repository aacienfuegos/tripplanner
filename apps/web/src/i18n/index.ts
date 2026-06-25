export { es } from "./es";
export { en } from "./en";
export type { WebTKeys } from "./es";

export type WebLocale = "es" | "en";

import { es } from "./es";
import { en } from "./en";

export function getStrings(locale: WebLocale) {
  return locale === "es" ? es : en;
}
