"use client";

import { ImportJobProvider } from "@/lib/import-job-context";
import { ImportStatusFloat } from "@/components/import/ImportStatusFloat";

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <ImportJobProvider>
      {children}
      <ImportStatusFloat />
    </ImportJobProvider>
  );
}
