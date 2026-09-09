"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { DivingLogImportPayload } from "@/lib/schemas";
import { DiveImportUploadStep } from "./DiveImportUploadStep";
import { DiveImportReviewStep } from "./DiveImportReviewStep";
import { useT } from "@/contexts/LanguageContext";

type Step = "upload" | "review";

export function DiveImportTrigger() {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("upload");
  const [payload, setPayload] = useState<DivingLogImportPayload | null>(null);

  const handleOpenChange = (o: boolean) => {
    if (!o) {
      setStep("upload");
      setPayload(null);
    }
    setOpen(o);
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Upload className="h-3.5 w-3.5 mr-1.5" />
        {t.diveImportTrigger}
      </Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col overflow-hidden gap-3">
          <DialogHeader>
            <DialogTitle>{t.diveImportTitle}</DialogTitle>
            <DialogDescription>
              {step === "upload" ? t.diveImportStepUpload : t.diveImportStepReview}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            {step === "upload" && (
              <DiveImportUploadStep
                onNext={(p) => {
                  setPayload(p);
                  setStep("review");
                }}
              />
            )}
            {step === "review" && payload && (
              <DiveImportReviewStep
                payload={payload}
                onBack={() => setStep("upload")}
                onDone={() => handleOpenChange(false)}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
