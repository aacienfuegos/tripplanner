"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, AlertCircle, X } from "lucide-react";
import { useImportJob } from "@/lib/import-job-context";

export function ImportStatusFloat() {
  const { status, tripId, error, dismissError } = useImportJob();
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (status !== "idle") {
      setMounted(true);
      // Next frame so the initial opacity-0/translate-x-4 renders first
      const raf = requestAnimationFrame(() => setShow(true));
      return () => cancelAnimationFrame(raf);
    } else {
      setShow(false);
      const t = setTimeout(() => setMounted(false), 300);
      return () => clearTimeout(t);
    }
  }, [status]);

  if (!mounted) return null;

  const isDone = status === "done" && !!tripId;
  const isError = status === "error";

  // Outer wrapper handles slide-in from the right
  const wrapperCls = `fixed top-[60px] right-4 z-40 transition-all duration-300 ease-out ${
    show ? "opacity-100 translate-x-0" : "opacity-0 translate-x-4"
  }`;

  // Inner chip transitions colors between states
  const chipCls = `flex items-center gap-2.5 rounded-xl border px-4 py-2.5 text-sm shadow-md transition-colors duration-500 ${
    isDone
      ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/50 dark:border-emerald-800"
      : isError
      ? "bg-card border-destructive/30"
      : "bg-card border-border"
  }`;

  return (
    <div className={wrapperCls}>
      {isDone ? (
        <button
          type="button"
          onClick={() => router.push(`/trips/${tripId}`)}
          className={`${chipCls} hover:bg-emerald-100 dark:hover:bg-emerald-900/50 cursor-pointer`}
        >
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="text-emerald-800 dark:text-emerald-300 font-medium">
            ¡Importación lista! Revisar →
          </span>
        </button>
      ) : isError ? (
        <div className={`${chipCls} max-w-xs`}>
          <AlertCircle className="h-4 w-4 text-destructive shrink-0 self-start mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-foreground font-medium leading-tight">Error en la importación</p>
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
      ) : (
        <div className={chipCls}>
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
          <span className="text-muted-foreground">Analizando tu reserva…</span>
        </div>
      )}
    </div>
  );
}
