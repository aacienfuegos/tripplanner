"use client";

import { SquareCheck, Luggage, PackageCheck, PackageX, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/contexts/LanguageContext";

interface Props {
  count: number;
  isPending: boolean;
  onToggleAll: () => void;
  onMove: () => void;
  onSetPacked: (packed: boolean) => void;
  onDelete: () => void;
  onExit: () => void;
}

// Sits above the mobile bottom nav (navbar.tsx), which is fixed at bottom-0 below md.
export function SelectionBar({ count, isPending, onToggleAll, onMove, onSetPacked, onDelete, onExit }: Props) {
  const { t } = useT();
  const disabled = isPending || count === 0;
  return (
    <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] md:bottom-0 z-40 border-t bg-background/95 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 py-2 flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium mr-auto">{t.packingSelectedCount(count)}</span>
        <Button size="sm" variant="outline" onClick={onToggleAll} disabled={isPending}>
          <SquareCheck className="h-4 w-4 mr-1" /> {t.selectAll}
        </Button>
        <Button size="sm" variant="outline" onClick={onMove} disabled={disabled}>
          <Luggage className="h-4 w-4 mr-1" /> {t.packingMoveToSuitcase}
        </Button>
        <Button size="sm" variant="outline" onClick={() => onSetPacked(true)} disabled={disabled}>
          <PackageCheck className="h-4 w-4 mr-1" /> {t.packingMarkPacked}
        </Button>
        <Button size="sm" variant="outline" onClick={() => onSetPacked(false)} disabled={disabled}>
          <PackageX className="h-4 w-4 mr-1" /> {t.packingUnmark}
        </Button>
        <Button size="sm" variant="destructive" onClick={onDelete} disabled={disabled}>
          <Trash2 className="h-4 w-4 mr-1" /> {t.delete}
        </Button>
        <Button size="sm" variant="ghost" onClick={onExit}>
          <X className="h-4 w-4 mr-1" /> {t.packingExitSelection}
        </Button>
      </div>
    </div>
  );
}
