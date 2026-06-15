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
import { AutoImportStep } from "./AutoImportStep";

type Step = 1 | 2 | 3;
type Mode = "auto" | "manual";

function stepLabel(step: Step, mode: Mode): string {
  if (mode === "auto") {
    return step === 1
      ? "Paso 1 de 2 — Introduce el contenido del viaje"
      : "Paso 2 de 2 — Revisa y confirma";
  }
  const labels: Record<Step, string> = {
    1: "Paso 1 de 3 — Obtén el prompt para la IA",
    2: "Paso 2 de 3 — Sube la respuesta de la IA",
    3: "Paso 3 de 3 — Revisa y confirma",
  };
  return labels[step];
}

export function ImportWizard({
  tripId,
  tripStartDate,
  tripEndDate,
  open,
  onOpenChange,
  agentosEnabled = false,
}: {
  tripId: string;
  tripStartDate?: string;
  tripEndDate?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentosEnabled?: boolean;
}) {
  const [step, setStep] = useState<Step>(1);
  const [mode, setMode] = useState<Mode>(agentosEnabled ? "auto" : "manual");
  const [payload, setPayload] = useState<ImportPayload | null>(null);

  const reset = () => {
    setStep(1);
    setPayload(null);
    setMode(agentosEnabled ? "auto" : "manual");
  };

  const handleOpenChange = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  const switchToManual = () => { setMode("manual"); setStep(1); };
  const switchToAuto   = () => { setMode("auto");   setStep(1); };

  const totalSteps = mode === "auto" ? 2 : 3;
  // In auto mode step 3 (ReviewStep) maps to visual position 2
  const visualStep = mode === "auto" && step === 3 ? 2 : step;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col overflow-hidden gap-3">
        <DialogHeader>
          <DialogTitle>Importar vía IA</DialogTitle>
          <DialogDescription>{stepLabel(step, mode)}</DialogDescription>
        </DialogHeader>

        <div className="flex gap-1.5">
          {Array.from({ length: totalSteps }, (_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i + 1 <= visualStep ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>

        <div className="flex-1 overflow-y-auto pr-1">
          {step === 1 && mode === "auto" && (
            <AutoImportStep
              tripStartDate={tripStartDate}
              tripEndDate={tripEndDate}
              onNext={(p) => { setPayload(p); setStep(3); }}
              onSwitchToManual={switchToManual}
            />
          )}
          {step === 1 && mode === "manual" && (
            <PromptStep
              tripStartDate={tripStartDate}
              tripEndDate={tripEndDate}
              onNext={() => setStep(2)}
              onSwitchToAuto={agentosEnabled ? switchToAuto : undefined}
            />
          )}
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
              onBack={() => (mode === "auto" ? setStep(1) : setStep(2))}
              onDone={() => handleOpenChange(false)}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
