"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { EquipmentForm } from "./equipment-form";
import { deleteDiveEquipment } from "@/actions/dive-equipment";
import type { DiveEquipment } from "@/types";
import { useT } from "@/contexts/LanguageContext";

export function EquipmentDetailActions({ equipment }: { equipment: DiveEquipment }) {
  const { t } = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();

  async function handleDelete() {
    const ok = await confirm({
      title: t.confirmDeleteEquipment,
      confirmLabel: t.delete,
      cancelLabel: t.cancel,
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteDiveEquipment(equipment.id);
      toast.success(t.deletedToastEquipment);
      router.push("/dives/equipment");
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
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t.editEquipment}</DialogTitle>
          </DialogHeader>
          <EquipmentForm equipment={equipment} onSuccess={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </div>
  );
}
