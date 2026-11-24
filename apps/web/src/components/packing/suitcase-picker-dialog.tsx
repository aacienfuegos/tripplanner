"use client";

import { Luggage, PackageOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Suitcase } from "@/types";
import { useT } from "@/contexts/LanguageContext";

interface Props {
  open: boolean;
  suitcases: readonly Suitcase[];
  onPick: (suitcaseId: string | null) => void;
  onCancel: () => void;
}

// Destination bag for the default list, the dive equipment and "move to a bag".
export function SuitcasePickerDialog({ open, suitcases, onPick, onCancel }: Props) {
  const { t } = useT();
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onCancel(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t.pickSuitcaseTitle}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          {suitcases.map((s) => (
            <Button key={s.id} variant="outline" className="justify-start" onClick={() => onPick(s.id)}>
              <Luggage className="h-4 w-4 mr-2" /> {s.name}
            </Button>
          ))}
          <Button variant="outline" className="justify-start" onClick={() => onPick(null)}>
            <PackageOpen className="h-4 w-4 mr-2" /> {t.noSuitcase}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
