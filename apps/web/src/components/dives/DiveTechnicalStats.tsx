"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DiveTechnicalStats({
  groupLabel,
  showLabel,
  hideLabel,
  hasData,
  children,
}: {
  groupLabel: string;
  showLabel: string;
  hideLabel: string;
  hasData: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(hasData);

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-auto p-0 text-sm font-medium text-muted-foreground hover:bg-transparent"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? hideLabel : showLabel}
      >
        {open ? <ChevronUp className="h-3.5 w-3.5 mr-1" /> : <ChevronDown className="h-3.5 w-3.5 mr-1" />}
        {groupLabel}
      </Button>
      {open && <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-5">{children}</div>}
    </div>
  );
}
