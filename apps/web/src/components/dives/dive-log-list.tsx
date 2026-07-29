"use client";

import { useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es as esLocale, enUS } from "date-fns/locale";
import { Plus, Waves, Pencil, Trash2, MapPin, Star, Thermometer, Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { DiveLogForm } from "./dive-log-form";
import { DiveImportTrigger } from "@/components/dive-import/DiveImportTrigger";
import { deleteDiveLog } from "@/actions/dives";
import type { DiveLogWithSite, DiveSite, GasMix } from "@/types";
import { useT } from "@/contexts/LanguageContext";

export function DiveLogList({ dives, sites }: { dives: DiveLogWithSite[]; sites: DiveSite[] }) {
  const { t } = useT();
  const dfLocale = t.locale === "es" ? esLocale : enUS;
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DiveLogWithSite | null>(null);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();

  const gasMixLabels: Record<GasMix, string> = {
    AIR: t.gasMixAir,
    NITROX: t.gasMixNitrox,
    TRIMIX: t.gasMixTrimix,
    OXYGEN: t.gasMixOxygen,
  };

  async function handleDelete(id: string) {
    const ok = await confirm({
      title: t.confirmDeleteDive,
      confirmLabel: t.delete,
      cancelLabel: t.cancel,
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteDiveLog(id);
      toast.success(t.deletedToastDive);
    } catch {
      toast.error(t.error);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" /> {t.addDive}
        </Button>
        <DiveImportTrigger />
      </div>

      {dives.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-muted-foreground">
            <Waves className="h-8 w-8 mx-auto mb-3 opacity-50" />
            <p>{t.noDives}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {dives.map((dive) => (
            <Card key={dive.id} id={dive.id} className="scroll-mt-16 target:ring-2 target:ring-primary/40">
              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary">#{dive.diveNumber}</Badge>
                      <span className="font-semibold">{dive.diveSite?.name ?? t.diveSiteNone}</span>
                      {dive.diveType && <Badge variant="outline">{dive.diveType}</Badge>}
                      <Badge variant="outline">{gasMixLabels[dive.gasMix]}</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground space-y-0.5">
                      <p>{format(dive.date, "d MMM yyyy", { locale: dfLocale })}</p>
                      <p className="flex items-center gap-1">
                        <Gauge className="h-3.5 w-3.5" /> {dive.depthMax} m · {dive.bottomTime} min
                      </p>
                      {(dive.diveSite?.region || dive.diveSite?.country) && (
                        <p className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {[dive.diveSite?.region, dive.diveSite?.country].filter(Boolean).join(", ")}
                        </p>
                      )}
                      {dive.waterTemp != null && (
                        <p className="flex items-center gap-1">
                          <Thermometer className="h-3.5 w-3.5" /> {dive.waterTemp}°C
                        </p>
                      )}
                      {dive.rating != null && (
                        <p className="flex items-center gap-1">
                          <Star className="h-3.5 w-3.5" /> {dive.rating}/5
                        </p>
                      )}
                      {dive.notes && <p className="italic">{dive.notes}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditing(dive);
                        setOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(dive.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `${t.editDive} #${editing.diveNumber}` : t.addDive}</DialogTitle>
          </DialogHeader>
          <DiveLogForm dive={editing ?? undefined} sites={sites} onSuccess={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </div>
  );
}
