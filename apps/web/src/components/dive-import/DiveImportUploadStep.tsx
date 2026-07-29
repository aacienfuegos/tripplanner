"use client";

import { useRef, useState, useTransition } from "react";
import { AlertCircle, Upload, Loader2 } from "lucide-react";
import { parseDivingLogFile, DivingLogParseErrorCode } from "@/actions/dive-import";
import { DivingLogImportPayload } from "@/lib/schemas";
import { useT } from "@/contexts/LanguageContext";
import type { WebTKeys } from "@/i18n";

function errorMessage(code: DivingLogParseErrorCode, maxSizeMb: number | undefined, t: WebTKeys): string {
  switch (code) {
    case "NO_FILE":
      return t.diveImportErrorNoFile;
    case "EMPTY_FILE":
      return t.diveImportErrorEmptyFile;
    case "FILE_TOO_LARGE":
      return t.diveImportErrorFileTooLarge(maxSizeMb ?? 50);
    case "UNRECOGNIZED_FILE":
      return t.diveImportErrorUnrecognizedFile;
    case "EMPTY_PAYLOAD":
      return t.diveImportErrorEmptyPayload;
    case "UNKNOWN":
      return t.diveImportErrorUnknown;
  }
}

export function DiveImportUploadStep({ onNext }: { onNext: (payload: DivingLogImportPayload) => void }) {
  const { t } = useT();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setError(null);
    const formData = new FormData();
    formData.set("file", file);
    startTransition(async () => {
      const result = await parseDivingLogFile(formData);
      if (!result.ok) {
        setError(errorMessage(result.errorCode, result.maxSizeMb, t));
        return;
      }
      onNext(result.payload);
    });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.diveImportIntro}</p>

      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={isPending}
        className="w-full border border-dashed rounded-lg p-6 text-sm text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors text-center cursor-pointer disabled:opacity-50"
      >
        {isPending ? (
          <Loader2 className="h-5 w-5 mx-auto mb-2 animate-spin" />
        ) : (
          <Upload className="h-5 w-5 mx-auto mb-2" />
        )}
        {isPending ? t.diveImportProcessing : t.diveImportDropZone}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".db,.sqlite,.sqlite3,.backup"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) handleFile(file);
        }}
      />

      {error && (
        <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}
    </div>
  );
}
