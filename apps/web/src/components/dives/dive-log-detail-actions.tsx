"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { DiveLogForm } from "./dive-log-form";
import { deleteDiveLog } from "@/actions/dives";
import type { DiveLogWithSite, DiveSite, DiveEquipment } from "@/types";
import { useT } from "@/contexts/LanguageContext";

export function DiveLogDetailActions({
  dive,
  sites,
  equipment,
}: {
  dive: DiveLogWithSite;
  sites: DiveSite[];
  equipment: DiveEquipment[];
}) {
  const { t } = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();

  async function handleDelete() {
    const ok = await confirm({
      title: t.confirmDeleteDive,
      confirmLabel: t.delete,
      cancelLabel: t.cancel,
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteDiveLog(dive.id);
      toast.success(t.deletedToastDive);
      router.push("/dives");
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
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t.editDive} #{dive.diveNumber}</DialogTitle>
          </DialogHeader>
          <DiveLogForm dive={dive} sites={sites} equipment={equipment} onSuccess={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </div>
  );
}
