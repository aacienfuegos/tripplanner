"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ImportPayload } from "@/lib/import-schemas";
import { useImportJob } from "@/lib/import-job-context";
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
  initialPayload,
}: {
  tripId: string;
  tripStartDate?: string;
  tripEndDate?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentosEnabled?: boolean;
  initialPayload?: ImportPayload | null;
}) {
  const [step, setStep] = useState<Step>(1);
  const [mode, setMode] = useState<Mode>(agentosEnabled ? "auto" : "manual");
  const [payload, setPayload] = useState<ImportPayload | null>(null);
  const { status: jobStatus, tripId: jobTripId, consumePayload } = useImportJob();

  // When the background import finishes while the dialog is open, advance to ReviewStep.
  useEffect(() => {
    if (open && jobStatus === "done" && jobTripId === tripId) {
      const p = consumePayload();
      if (p) { setPayload(p); setStep(3); }
    }
  }, [open, jobStatus, jobTripId, tripId, consumePayload]);

  // When opening with a pre-loaded payload (from background import via float), jump to review.
  useEffect(() => {
    if (open && initialPayload) {
      setStep(3);
      setPayload(initialPayload);
    }
  }, [open, initialPayload]);

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
              tripId={tripId}
              tripStartDate={tripStartDate}
              tripEndDate={tripEndDate}
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
