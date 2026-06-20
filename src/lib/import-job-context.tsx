"use client";

import { createContext, useContext, useState, useRef, useCallback, ReactNode } from "react";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { runAgentOSImport } from "@/actions/agentos";
import { ImportPayload } from "@/lib/import-schemas";

type ImportJobStatus = "idle" | "running" | "done" | "error";

interface ImportJobState {
  status: ImportJobStatus;
  tripId: string | null;
  payload: ImportPayload | null;
  error: string | null;
}

interface ImportJobContextValue extends ImportJobState {
  startImport: (
    tripId: string,
    content: string,
    options?: { tripStartDate?: string; tripEndDate?: string },
  ) => void;
  consumePayload: () => ImportPayload | null;
  dismissError: () => void;
}

const ImportJobContext = createContext<ImportJobContextValue | null>(null);

export function ImportJobProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ImportJobState>({
    status: "idle",
    tripId: null,
    payload: null,
    error: null,
  });
  // Ref allows synchronous read/clear inside useEffect (functional setState updater
  // runs asynchronously, so it can't be used to return a value reliably).
  const payloadRef = useRef<ImportPayload | null>(null);

  const startImport = useCallback(
    (
      tripId: string,
      content: string,
      options?: { tripStartDate?: string; tripEndDate?: string },
    ) => {
      payloadRef.current = null;
      setState({ status: "running", tripId, payload: null, error: null });
      runAgentOSImport(content, options)
        .then((payload) => {
          payloadRef.current = payload;
          setState((prev) => ({ ...prev, status: "done", payload }));
        })
        .catch((e) => {
          if (isRedirectError(e)) {
            setState({ status: "idle", tripId: null, payload: null, error: null });
            return;
          }
          setState((prev) => ({
            ...prev,
            status: "error",
            error: e instanceof Error ? e.message : "Error desconocido.",
          }));
        });
    },
    [],
  );

  // Reads payload synchronously from ref (reliable inside useEffect), then resets to idle.
  // The first caller wins; subsequent callers get null.
  const consumePayload = useCallback((): ImportPayload | null => {
    const result = payloadRef.current;
    payloadRef.current = null;
    setState({ status: "idle", tripId: null, payload: null, error: null });
    return result;
  }, []);

  const dismissError = useCallback(() => {
    setState({ status: "idle", tripId: null, payload: null, error: null });
  }, []);

  return (
    <ImportJobContext.Provider value={{ ...state, startImport, consumePayload, dismissError }}>
      {children}
    </ImportJobContext.Provider>
  );
}

export function useImportJob(): ImportJobContextValue {
  const ctx = useContext(ImportJobContext);
  if (!ctx) throw new Error("useImportJob must be used inside ImportJobProvider");
  return ctx;
}
