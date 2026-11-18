"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ImportPayload } from "@tripplanner/shared";
import { PromptStep } from "./PromptStep";
import { UploadStep } from "./UploadStep";
import { ReviewStep } from "./ReviewStep";
import { useT } from "@/contexts/LanguageContext";
import type { WebTKeys } from "@/i18n";

type Step = 1 | 2 | 3;

function stepLabel(step: Step, t: WebTKeys): string {
  const labels: Record<Step, string> = {
    1: t.importStepManual1,
    2: t.importStepManual2,
    3: t.importStepManual3,
  };
  return labels[step];
}

export function ImportWizard({
  tripId,
  tripStartDate,
  tripEndDate,
  open,
  onOpenChange,
}: {
  tripId: string;
  tripStartDate?: string;
  tripEndDate?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useT();
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
          <DialogTitle>{t.importAI}</DialogTitle>
          <DialogDescription>{stepLabel(step, t)}</DialogDescription>
        </DialogHeader>

        <div className="flex gap-1.5">
          {Array.from({ length: 3 }, (_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i + 1 <= step ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>

        <div className="flex-1 overflow-y-auto pr-1">
          {step === 1 && (
            <PromptStep
              tripStartDate={tripStartDate}
              tripEndDate={tripEndDate}
              onNext={() => setStep(2)}
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
              onBack={() => setStep(2)}
              onDone={() => handleOpenChange(false)}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
