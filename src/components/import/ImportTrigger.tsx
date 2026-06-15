"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
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
        onOpenChange={setOpen}
        agentosEnabled={agentosEnabled}
      />
    </>
  );
}
