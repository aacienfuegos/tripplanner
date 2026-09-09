// Fuente de verdad para país: código ISO 3166-1 alpha-2, resuelto a nombre
// localizado en el momento de mostrarlo (vía Intl.DisplayNames, ya integrado
// en Node/ICU y en Hermes desde RN 0.71+) — nunca se guarda el nombre en
// texto libre, así un mismo país no puede aparecer duplicado por idioma
// (ver issue #265: Diving Log exporta "Spain", el resto de la app usaba
// "España"). Reutilizado por web y android.
//
// Lista (fuente: paquete iso-codes, no cambia salvo eventos geopolíticos
// raros) — solo los códigos, sin nombres a mano.
export const ISO_3166_ALPHA2_CODES = [
  "AD", "AE", "AF", "AG", "AI", "AL", "AM", "AO", "AQ", "AR", "AS", "AT", "AU", "AW", "AX", "AZ",
  "BA", "BB", "BD", "BE", "BF", "BG", "BH", "BI", "BJ", "BL", "BM", "BN", "BO", "BQ", "BR", "BS",
  "BT", "BV", "BW", "BY", "BZ", "CA", "CC", "CD", "CF", "CG", "CH", "CI", "CK", "CL", "CM", "CN",
  "CO", "CR", "CU", "CV", "CW", "CX", "CY", "CZ", "DE", "DJ", "DK", "DM", "DO", "DZ", "EC", "EE",
  "EG", "EH", "ER", "ES", "ET", "FI", "FJ", "FK", "FM", "FO", "FR", "GA", "GB", "GD", "GE", "GF",
  "GG", "GH", "GI", "GL", "GM", "GN", "GP", "GQ", "GR", "GS", "GT", "GU", "GW", "GY", "HK", "HM",
  "HN", "HR", "HT", "HU", "ID", "IE", "IL", "IM", "IN", "IO", "IQ", "IR", "IS", "IT", "JE", "JM",
  "JO", "JP", "KE", "KG", "KH", "KI", "KM", "KN", "KP", "KR", "KW", "KY", "KZ", "LA", "LB", "LC",
  "LI", "LK", "LR", "LS", "LT", "LU", "LV", "LY", "MA", "MC", "MD", "ME", "MF", "MG", "MH", "MK",
  "ML", "MM", "MN", "MO", "MP", "MQ", "MR", "MS", "MT", "MU", "MV", "MW", "MX", "MY", "MZ", "NA",
  "NC", "NE", "NF", "NG", "NI", "NL", "NO", "NP", "NR", "NU", "NZ", "OM", "PA", "PE", "PF", "PG",
  "PH", "PK", "PL", "PM", "PN", "PR", "PS", "PT", "PW", "PY", "QA", "RE", "RO", "RS", "RU", "RW",
  "SA", "SB", "SC", "SD", "SE", "SG", "SH", "SI", "SJ", "SK", "SL", "SM", "SN", "SO", "SR", "SS",
  "ST", "SV", "SX", "SY", "SZ", "TC", "TD", "TF", "TG", "TH", "TJ", "TK", "TL", "TM", "TN", "TO",
  "TR", "TT", "TV", "TW", "TZ", "UA", "UG", "UM", "US", "UY", "UZ", "VA", "VC", "VE", "VG", "VI",
  "VN", "VU", "WF", "WS", "YE", "YT", "ZA", "ZM", "ZW",
] as const;

export type CountryCode = (typeof ISO_3166_ALPHA2_CODES)[number];

const CODE_SET: ReadonlySet<string> = new Set(ISO_3166_ALPHA2_CODES);

export function isValidCountryCode(value: string): value is CountryCode {
  return CODE_SET.has(value);
}

const displayNamesCache = new Map<string, Intl.DisplayNames>();

function displayNamesFor(locale: string): Intl.DisplayNames {
  let dn = displayNamesCache.get(locale);
  if (!dn) {
    dn = new Intl.DisplayNames([locale], { type: "region" });
    displayNamesCache.set(locale, dn);
  }
  return dn;
}

// Resuelve un código a su nombre en el idioma pedido. Si el código no es
// válido, lo devuelve tal cual en vez de lanzar (best-effort).
export function countryCodeToName(code: string, locale: "es" | "en" = "es"): string {
  if (!isValidCountryCode(code)) return code;
  return displayNamesFor(locale).of(code) ?? code;
}

// name (en inglés o español, sin distinguir mayúsculas) -> código. Se
// construye una única vez combinando ambos idiomas, para reconocer tanto
// "Spain" (como lo exporta Diving Log) como "España" (datos ya migrados a
// mano o en textos previos a esta migración).
let nameToCodeCache: Map<string, CountryCode> | null = null;

function nameToCode(): Map<string, CountryCode> {
  if (!nameToCodeCache) {
    const map = new Map<string, CountryCode>();
    for (const locale of ["en", "es"] as const) {
      const dn = displayNamesFor(locale);
      for (const code of ISO_3166_ALPHA2_CODES) {
        const name = dn.of(code);
        if (name) map.set(name.toLowerCase(), code);
      }
    }
    nameToCodeCache = map;
  }
  return nameToCodeCache;
}

// Traduce un nombre de país (o un código ya válido) a código ISO. Devuelve
// null si no lo reconoce — el llamante decide el fallback (dejar vacío,
// pedir al usuario que lo elija a mano), nunca se inventa un valor.
export function countryNameToCode(raw: string): CountryCode | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const upper = trimmed.toUpperCase();
  if (upper.length === 2 && isValidCountryCode(upper)) return upper as CountryCode;
  return nameToCode().get(trimmed.toLowerCase()) ?? null;
}

// Lista completa {code, name} en el idioma pedido, ordenada por nombre —
// para selectores de país.
export function countryOptions(locale: "es" | "en" = "es"): { code: CountryCode; name: string }[] {
  const dn = displayNamesFor(locale);
  return ISO_3166_ALPHA2_CODES.map((code) => ({ code, name: dn.of(code) ?? code })).sort((a, b) =>
    a.name.localeCompare(b.name, locale),
  );
}
