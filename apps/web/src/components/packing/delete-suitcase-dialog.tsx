"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useT } from "@/contexts/LanguageContext";

export type DeleteSuitcaseMode = "unassign" | "deleteItems";

interface Props {
  open: boolean;
  suitcaseName: string;
  itemCount: number;
  onChoose: (mode: DeleteSuitcaseMode) => void;
  onCancel: () => void;
}

// For a bag with items: confirm-dialog has two buttons and this needs three.
export function DeleteSuitcaseDialog({ open, suitcaseName, itemCount, onChoose, onCancel }: Props) {
  const { t } = useT();
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onCancel(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t.confirmDeleteSuitcase}</DialogTitle>
          <DialogDescription>{suitcaseName} · {t.suitcaseHasItems(itemCount)}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-col gap-2">
          <Button variant="outline" onClick={() => onChoose("unassign")}>{t.suitcaseUnassignItems}</Button>
          <Button variant="destructive" onClick={() => onChoose("deleteItems")}>{t.suitcaseDeleteItems}</Button>
          <Button variant="ghost" onClick={onCancel}>{t.cancel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
