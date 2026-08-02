// Lista ISO 3166-1 alpha-2 (fuente: paquete iso-codes, no cambia salvo
// eventos geopolíticos raros) — solo los códigos, sin nombres a mano: los
// nombres en cada idioma los da Intl.DisplayNames, ya integrado en Node/ICU.
const ISO_3166_ALPHA2_CODES = [
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
];

let nameToCodeCache: Map<string, string> | null = null;

function nameToCode(): Map<string, string> {
  if (!nameToCodeCache) {
    const en = new Intl.DisplayNames(["en"], { type: "region" });
    nameToCodeCache = new Map(
      ISO_3166_ALPHA2_CODES.map((code) => [(en.of(code) ?? code).toLowerCase(), code]),
    );
  }
  return nameToCodeCache;
}

// Traduce un nombre de país a su forma canónica en español, para que un
// mismo país no aparezca duplicado por idioma (p.ej. Diving Log exporta
// "Spain" en inglés, pero el resto de la app usa "España"). Solo reconoce
// nombres en inglés (el idioma que usan los desplegables de Diving Log);
// si no lo encuentra, lo deja tal cual — best-effort, nunca lanza.
export function normalizeCountryName(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return raw;
  const code = nameToCode().get(trimmed.toLowerCase());
  if (!code) return raw;
  const es = new Intl.DisplayNames(["es"], { type: "region" });
  return es.of(code) ?? raw;
}
