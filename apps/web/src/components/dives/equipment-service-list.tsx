"use client";

import { useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es as esLocale, enUS } from "date-fns/locale";
import { Plus, Wrench, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { EquipmentServiceForm } from "./equipment-service-form";
import { deleteDiveEquipmentService } from "@/actions/dive-equipment";
import type { DiveEquipmentService } from "@/types";
import { useT } from "@/contexts/LanguageContext";

export function EquipmentServiceList({ equipmentId, services }: { equipmentId: string; services: DiveEquipmentService[] }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const dfLocale = t.locale === "es" ? esLocale : enUS;
  const currencyFormatter = new Intl.NumberFormat(t.locale === "es" ? "es-ES" : "en-US", {
    style: "currency",
    currency: "EUR",
  });

  async function handleDelete(id: string) {
    const ok = await confirm({
      title: t.confirmDeleteEquipmentService,
      confirmLabel: t.delete,
      cancelLabel: t.cancel,
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteDiveEquipmentService(id);
      toast.success(t.deletedToastEquipmentService);
    } catch {
      toast.error(t.error);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Wrench className="h-4 w-4" /> {t.equipmentServiceHistory}
        </h2>
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> {t.equipmentAddService}
        </Button>
      </div>

      {services.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-6 text-center text-muted-foreground text-sm">{t.noEquipmentService}</CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {services.map((s) => (
            <Card key={s.id}>
              <CardContent className="py-3 flex items-center gap-4">
                <span className="text-sm text-muted-foreground shrink-0">{format(s.date, "d MMM yyyy", { locale: dfLocale })}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{s.description}</p>
                  {s.notes && <p className="text-xs text-muted-foreground truncate">{s.notes}</p>}
                </div>
                {s.cost != null && <span className="text-sm text-muted-foreground shrink-0">{currencyFormatter.format(s.cost)}</span>}
                <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t.equipmentAddService}</DialogTitle>
          </DialogHeader>
          <EquipmentServiceForm equipmentId={equipmentId} onSuccess={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </div>
  );
}
