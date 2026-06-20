"use client";

import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, AlertCircle, X } from "lucide-react";
import { useImportJob } from "@/lib/import-job-context";

export function ImportStatusFloat() {
  const { status, tripId, error, dismissError } = useImportJob();
  const router = useRouter();

  if (status === "idle") return null;

  if (status === "running") {
    return (
      <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2.5 bg-card border rounded-xl shadow-lg px-4 py-3 text-sm pointer-events-none">
        <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
        <span className="text-foreground">Analizando tu reserva…</span>
      </div>
    );
  }

  if (status === "done" && tripId) {
    return (
      <button
        type="button"
        onClick={() => router.push(`/trips/${tripId}`)}
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2.5 bg-card border border-primary/40 rounded-xl shadow-lg px-4 py-3 text-sm hover:bg-accent transition-colors cursor-pointer"
      >
        <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
        <span className="text-foreground font-medium">¡Importación lista! Revisar →</span>
      </button>
    );
  }

  if (status === "error") {
    return (
      <div className="fixed bottom-4 right-4 z-50 flex items-start gap-2.5 bg-card border border-destructive/30 rounded-xl shadow-lg px-4 py-3 text-sm max-w-xs">
        <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-foreground font-medium">Error en la importación</p>
          {error && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{error}</p>
          )}
        </div>
        <button
          type="button"
          onClick={dismissError}
          className="text-muted-foreground hover:text-foreground shrink-0 ml-1"
          aria-label="Cerrar"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return null;
}
