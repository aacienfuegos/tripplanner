"use client";

import { useState } from "react";
import { generateImportPrompt } from "@/lib/import-prompt";
import { Button } from "@/components/ui/button";
import { Copy, Download, Check } from "lucide-react";

export function PromptStep({
  tripStartDate,
  tripEndDate,
  onNext,
  onSwitchToAuto,
}: {
  tripStartDate?: string;
  tripEndDate?: string;
  onNext: () => void;
  onSwitchToAuto?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const prompt = generateImportPrompt({ tripStartDate, tripEndDate });

  const handleCopy = async () => {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([prompt], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tripplanner-import-prompt.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Copia este prompt y pégalo en Claude, ChatGPT o Gemini junto con el contenido
        de tu PDF, email de reserva o itinerario.
      </p>

      <pre className="text-xs bg-muted rounded-lg p-3 overflow-y-auto max-h-56 font-mono leading-relaxed whitespace-pre-wrap break-words">
        {prompt}
      </pre>

      <div className="flex gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={handleCopy}>
          {copied
            ? <Check className="h-3.5 w-3.5 mr-1.5 text-green-600" />
            : <Copy className="h-3.5 w-3.5 mr-1.5" />}
          {copied ? "Copiado" : "Copiar al portapapeles"}
        </Button>
        <Button variant="outline" size="sm" onClick={handleDownload}>
          <Download className="h-3.5 w-3.5 mr-1.5" />
          Descargar .txt
        </Button>
      </div>

      <div className="flex justify-between items-center pt-2 border-t">
        {onSwitchToAuto ? (
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
            onClick={onSwitchToAuto}
          >
            ← Usar modo automático
          </button>
        ) : (
          <span />
        )}
        <Button size="sm" onClick={onNext}>
          Ya tengo la respuesta →
        </Button>
      </div>
    </div>
  );
}
