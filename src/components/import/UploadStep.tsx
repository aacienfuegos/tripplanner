"use client";

import { useState, useRef } from "react";
import { importPayloadSchema, ImportPayload } from "@/lib/import-schemas";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, Upload } from "lucide-react";

function parsePayload(raw: string, setError: (e: string | null) => void): ImportPayload | null {
  setError(null);
  if (!raw.trim()) return null;

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    setError(
      "El JSON no es válido. Asegúrate de que la respuesta de la IA no incluye texto ni comillas adicionales fuera del JSON."
    );
    return null;
  }

  const result = importPayloadSchema.safeParse(json);
  if (!result.success) {
    const first = result.error.issues[0];
    const path = first?.path?.join(".");
    setError(path ? `Campo "${path}": ${first.message}` : (first?.message ?? "Error de formato en la respuesta."));
    return null;
  }

  return result.data;
}

function countItems(payload: ImportPayload): number {
  return (
    payload.flights.length +
    payload.accommodations.length +
    payload.activities.length +
    payload.expenses.length +
    payload.packing.length +
    payload.documents.length
  );
}

export function UploadStep({
  onBack,
  onNext,
}: {
  onBack: () => void;
  onNext: (payload: ImportPayload) => void;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const content = await file.text();
    setText(content);
    const payload = parsePayload(content, setError);
    if (!payload) return;
    if (countItems(payload) === 0) {
      setError("El fichero no contiene ningún ítem reconocible.");
      return;
    }
    onNext(payload);
  };

  const handleNext = () => {
    const payload = parsePayload(text, setError);
    if (!payload) return;
    if (countItems(payload) === 0) {
      setError(
        "El JSON no contiene ningún ítem reconocible. Asegúrate de que la IA encontró datos en el contenido que le pasaste."
      );
      return;
    }
    onNext(payload);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Pega el JSON que devolvió la IA, o sube directamente el fichero{" "}
        <code className="text-xs bg-muted px-1 rounded">.json</code>.
      </p>

      <Textarea
        value={text}
        onChange={(e) => { setText(e.target.value); setError(null); }}
        placeholder={'{ "flights": [...], "accommodations": [...] }'}
        className="font-mono text-xs min-h-48 resize-none"
      />

      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground">o</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="w-full border border-dashed rounded-lg p-4 text-sm text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors text-center cursor-pointer"
      >
        <Upload className="h-4 w-4 mx-auto mb-1.5" />
        Arrastra un fichero .json o haz clic para seleccionarlo
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleFileChange}
      />

      {error && (
        <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      <div className="flex justify-between pt-2 border-t">
        <Button variant="ghost" size="sm" onClick={onBack}>
          ← Volver
        </Button>
        <Button size="sm" onClick={handleNext} disabled={!text.trim()}>
          Revisar ítems →
        </Button>
      </div>
    </div>
  );
}
