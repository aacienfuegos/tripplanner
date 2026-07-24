"use client";

import { createContext, useContext, useState, useEffect, useTransition } from "react";
import { es, en, getStrings, type WebTKeys, type WebLocale } from "@/i18n";

interface LanguageContextValue {
  locale: WebLocale;
  t: WebTKeys;
  setLocale: (l: WebLocale) => void;
  isPending: boolean;
}

const LanguageContext = createContext<LanguageContextValue>({
  locale: "en",
  t: en,
  setLocale: () => {},
  isPending: false,
});

function detectBrowserLocale(): WebLocale {
  if (typeof navigator === "undefined") return "en";
  const lang = navigator.language?.split("-")[0].toLowerCase();
  return lang === "es" ? "es" : "en";
}

export function LanguageProvider({
  children,
  initialLocale,
}: {
  children: React.ReactNode;
  initialLocale: WebLocale;
}) {
  const [locale, setLocaleState] = useState<WebLocale>(initialLocale);
  const [isPending, startTransition] = useTransition();

  function setLocale(l: WebLocale) {
    startTransition(() => {
      setLocaleState(l);
      document.cookie = `locale=${l};path=/;max-age=${60 * 60 * 24 * 365};SameSite=Lax`;
    });
  }

  return (
    <LanguageContext.Provider value={{ locale, t: getStrings(locale), setLocale, isPending }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useT() {
  return useContext(LanguageContext);
}
