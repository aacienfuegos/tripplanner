"use client";

import { useState, useEffect } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImportPayload } from "@tripplanner/shared";
import { useImportJob } from "@/lib/import-job-context";
import { ImportWizard } from "./ImportWizard";
import { useT } from "@/contexts/LanguageContext";

export function ImportTrigger({
  tripId,
  tripStartDate,
  tripEndDate,
  agentosEnabled = false,
}: {
  tripId: string;
  tripStartDate?: string;
  tripEndDate?: string;
  agentosEnabled?: boolean;
}) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<ImportPayload | null>(null);
  const { status, payload, tripId: jobTripId, registerOpenWizard } = useImportJob();

  // Let the float open the wizard by calling openWizard() from the context.
  useEffect(() => registerOpenWizard(() => setOpen(true)), [registerOpenWizard]);

  // Mirror context payload into local state so the wizard can use it as initialPayload.
  // Don't consume here — the float or the wizard's own effect handles consumption.
  useEffect(() => {
    if (status === "done" && jobTripId === tripId && payload) {
      setPendingPayload(payload);
    }
  }, [status, jobTripId, tripId, payload]);

  const handleOpenChange = (o: boolean) => {
    if (!o) setPendingPayload(null);
    setOpen(o);
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Upload className="h-3.5 w-3.5 mr-1.5" />
        {t.importAI}
      </Button>
      <ImportWizard
        tripId={tripId}
        tripStartDate={tripStartDate}
        tripEndDate={tripEndDate}
        open={open}
        onOpenChange={handleOpenChange}
        agentosEnabled={agentosEnabled}
        initialPayload={pendingPayload}
      />
    </>
  );
}
