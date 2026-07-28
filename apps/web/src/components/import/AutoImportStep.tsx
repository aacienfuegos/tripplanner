"use client";

import { useState, useRef, useCallback } from "react";
import { useImportJob } from "@/lib/import-job-context";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, Upload, FileText } from "lucide-react";
import { AgentOSLoader } from "./AgentOSLoader";
import { useT } from "@/contexts/LanguageContext";

async function loadPdfJs() {
  const pdfjs = await import("pdfjs-dist");
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
  }
  return pdfjs;
}

async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await loadPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    pages.push(pageText);
  }
  return pages.join("\n\n");
}

type LocalStatus = "idle" | "extracting" | "error";

export function AutoImportStep({
  tripId,
  tripStartDate,
  tripEndDate,
  onSwitchToManual,
}: {
  tripId: string;
  tripStartDate?: string;
  tripEndDate?: string;
  onSwitchToManual: () => void;
}) {
  const { t } = useT();
  const { startImport, status: jobStatus } = useImportJob();
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<LocalStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [pdfName, setPdfName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = "";

      if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        setStatus("extracting");
        setError(null);
        try {
          const text = await extractPdfText(file);
          if (!text.trim() || text.trim().length < 50) {
            setError(t.pdfNoTextError);
            setStatus("idle");
            return;
          }
          setContent(text.trim());
          setPdfName(file.name);
          setStatus("idle");
        } catch {
          setError(t.pdfReadError);
          setStatus("idle");
        }
      } else {
        const text = await file.text();
        setContent(text.trim());
        setPdfName(file.name);
      }
    },
    [],
  );

  const handleSubmit = () => {
    if (!content.trim() || jobStatus === "running") return;
    startImport(tripId, content.trim(), { tripStartDate, tripEndDate });
  };

  if (jobStatus === "running") {
    return <AgentOSLoader />;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t.autoImportIntro}
      </p>

      {pdfName && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted rounded-md px-3 py-2">
          <FileText className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{pdfName}</span>
          <button
            type="button"
            className="ml-auto hover:text-foreground"
            onClick={() => { setPdfName(null); setContent(""); }}
          >
            ×
          </button>
        </div>
      )}

      <Textarea
        value={content}
        onChange={(e) => { setContent(e.target.value); setError(null); setPdfName(null); }}
        placeholder={t.autoImportPlaceholder}
        className="font-mono text-xs min-h-48 resize-none"
        disabled={status === "extracting"}
      />

      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground">{t.or}</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={status === "extracting"}
        className="w-full border border-dashed rounded-lg p-4 text-sm text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors text-center cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Upload className="h-4 w-4 mx-auto mb-1.5" />
        {status === "extracting" ? t.extractingPdf : t.uploadPdfOrTxt}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.txt,application/pdf,text/plain"
        className="hidden"
        onChange={handleFileChange}
      />

      {error && (
        <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p>{error}</p>
            <button
              type="button"
              className="text-xs underline underline-offset-2 text-muted-foreground hover:text-foreground"
              onClick={onSwitchToManual}
            >
              {t.useManualModeInstead}
            </button>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center pt-2 border-t">
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
          onClick={onSwitchToManual}
        >
          {t.preferOwnAi}
        </button>
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!content.trim() || status === "extracting"}
        >
          {t.analyzeWithAi}
        </Button>
      </div>
    </div>
  );
}
