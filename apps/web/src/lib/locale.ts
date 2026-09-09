import { cookies, headers } from "next/headers";
import type { WebLocale } from "@/i18n";
import { getStrings } from "@/i18n";

const COOKIE_NAME = "locale";
const SUPPORTED: WebLocale[] = ["es", "en"];

function parseAcceptLanguage(header: string): WebLocale {
  const langs = header
    .split(",")
    .map((part) => {
      const [lang, q = "q=1"] = part.trim().split(";");
      const quality = parseFloat(q.split("=")[1] ?? "1");
      return { lang: lang.trim().split("-")[0].toLowerCase(), quality };
    })
    .sort((a, b) => b.quality - a.quality);

  for (const { lang } of langs) {
    if ((SUPPORTED as string[]).includes(lang)) return lang as WebLocale;
  }
  return "en";
}

export async function getLocale(): Promise<WebLocale> {
  const cookieStore = await cookies();
  const saved = cookieStore.get(COOKIE_NAME)?.value;
  if (saved && (SUPPORTED as string[]).includes(saved)) return saved as WebLocale;

  const headerStore = await headers();
  const acceptLang = headerStore.get("accept-language") ?? "";
  if (acceptLang) return parseAcceptLanguage(acceptLang);

  return "en";
}

export async function getT() {
  const locale = await getLocale();
  return getStrings(locale);
}
