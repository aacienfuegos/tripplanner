"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ImportPayload } from "@/lib/import-schemas";
import { PromptStep } from "./PromptStep";
import { UploadStep } from "./UploadStep";
import { ReviewStep } from "./ReviewStep";

type Step = 1 | 2 | 3;

const STEP_LABELS: Record<Step, string> = {
  1: "Paso 1 de 3 — Obtén el prompt para la IA",
  2: "Paso 2 de 3 — Sube la respuesta de la IA",
  3: "Paso 3 de 3 — Revisa y confirma",
};

export function ImportWizard({
  tripId,
  open,
  onOpenChange,
}: {
  tripId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [step, setStep] = useState<Step>(1);
  const [payload, setPayload] = useState<ImportPayload | null>(null);

  const reset = () => {
    setStep(1);
    setPayload(null);
  };

  const handleOpenChange = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col overflow-hidden gap-3">
        <DialogHeader>
          <DialogTitle>Importar vía IA</DialogTitle>
          <DialogDescription>{STEP_LABELS[step]}</DialogDescription>
        </DialogHeader>

        {/* Step progress bar */}
        <div className="flex gap-1.5">
          {([1, 2, 3] as Step[]).map((s) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-colors ${
                s <= step ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>

        <div className="flex-1 overflow-y-auto pr-1">
          {step === 1 && <PromptStep onNext={() => setStep(2)} />}
          {step === 2 && (
            <UploadStep
              onBack={() => setStep(1)}
              onNext={(p) => { setPayload(p); setStep(3); }}
            />
          )}
          {step === 3 && payload && (
            <ReviewStep
              tripId={tripId}
              payload={payload}
              onBack={() => setStep(2)}
              onDone={() => handleOpenChange(false)}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
