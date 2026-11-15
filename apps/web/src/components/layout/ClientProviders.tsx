"use client";

import { LanguageProvider } from "@/contexts/LanguageContext";
import type { WebLocale } from "@/i18n";

export function ClientProviders({
  children,
  initialLocale,
}: {
  children: React.ReactNode;
  initialLocale: WebLocale;
}) {
  return (
    <LanguageProvider initialLocale={initialLocale}>
      {children}
    </LanguageProvider>
  );
}
