"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImportWizard } from "./ImportWizard";
import { useT } from "@/contexts/LanguageContext";

export function ImportTrigger({
  tripId,
  tripStartDate,
  tripEndDate,
}: {
  tripId: string;
  tripStartDate?: string;
  tripEndDate?: string;
}) {
  const { t } = useT();
  const [open, setOpen] = useState(false);

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
        onOpenChange={setOpen}
      />
    </>
  );
}
