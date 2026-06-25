"use client";

import { ImportJobProvider } from "@/lib/import-job-context";
import { ImportStatusFloat } from "@/components/import/ImportStatusFloat";
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
      <ImportJobProvider>
        {children}
        <ImportStatusFloat />
      </ImportJobProvider>
    </LanguageProvider>
  );
}
