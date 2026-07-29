"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { DiveAreaForm } from "./dive-area-form";
import { deleteDiveArea } from "@/actions/dive-sites";
import type { DiveArea } from "@/types";
import { useT } from "@/contexts/LanguageContext";

export function DiveAreaDetailActions({ area }: { area: DiveArea }) {
  const { t } = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();

  async function handleDelete() {
    const ok = await confirm({
      title: t.confirmDeleteDiveArea,
      confirmLabel: t.delete,
      cancelLabel: t.cancel,
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteDiveArea(area.id);
      toast.success(t.deletedToastDiveArea);
      router.push("/dives/sites");
    } catch {
      toast.error(t.error);
    }
  }

  return (
    <div className="flex items-center gap-1 shrink-0">
      <Button variant="ghost" size="icon" onClick={() => setOpen(true)}>
        <Pencil className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" onClick={handleDelete}>
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t.editDiveArea}</DialogTitle>
          </DialogHeader>
          <DiveAreaForm area={area} onSuccess={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </div>
  );
}
