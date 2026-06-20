"use client";

import { useState, useEffect } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImportPayload } from "@/lib/import-schemas";
import { useImportJob } from "@/lib/import-job-context";
import { ImportWizard } from "./ImportWizard";

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
  const [open, setOpen] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<ImportPayload | null>(null);
  const { status, tripId: jobTripId, consumePayload } = useImportJob();

  // Auto-open the wizard at ReviewStep when a background import finishes for this trip.
  useEffect(() => {
    if (status === "done" && jobTripId === tripId) {
      const p = consumePayload();
      if (p) {
        setPendingPayload(p);
        setOpen(true);
      }
    }
  }, [status, jobTripId, tripId, consumePayload]);

  const handleOpenChange = (o: boolean) => {
    if (!o) setPendingPayload(null);
    setOpen(o);
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Upload className="h-3.5 w-3.5 mr-1.5" />
        Importar vía IA
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
