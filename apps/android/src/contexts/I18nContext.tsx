import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Localization from "expo-localization";
import { es } from "@/i18n/es";
import { en } from "@/i18n/en";

export type Lang = "es" | "en";
const STORAGE_KEY = "@tripplanner/language";

function systemLang(): Lang {
  const code = Localization.getLocales()[0]?.languageCode ?? "en";
  return code === "es" ? "es" : "en";
}

interface I18nContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: typeof es;
}

const I18nContext = createContext<I18nContextValue>({
  lang: "es",
  setLang: () => {},
  t: es,
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(systemLang);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === "es" || stored === "en") setLangState(stored);
    });
  }, []);

  function setLang(l: Lang) {
    setLangState(l);
    AsyncStorage.setItem(STORAGE_KEY, l);
  }

  const t = lang === "es" ? es : en;

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useT() {
  return useContext(I18nContext);
}
