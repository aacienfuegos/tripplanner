"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { es as esLocale, enUS } from "date-fns/locale";
import { Plus, Waves, Pencil, Trash2, MapPin, Star, Thermometer, ArrowDownToLine, Timer, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { DiveLogForm } from "./dive-log-form";
import { DiveImportTrigger } from "@/components/dive-import/DiveImportTrigger";
import { deleteDiveLog } from "@/actions/dives";
import type { DiveLogWithSite, DiveSite, DiveEquipment, GasMix } from "@/types";
import { useT } from "@/contexts/LanguageContext";
import { DIVE_TYPE_KEYS, diveTypeKeyLabels, diveTypeLabel } from "@/lib/dive-type";
import { formatDiveDate } from "@/lib/dive-date";

const FILTER_ALL = "ALL";

export function DiveLogList({
  dives,
  sites,
  equipment,
}: {
  dives: DiveLogWithSite[];
  sites: DiveSite[];
  equipment: DiveEquipment[];
}) {
  const { t } = useT();
  const router = useRouter();
  const dfLocale = t.locale === "es" ? esLocale : enUS;
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DiveLogWithSite | null>(null);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const [typeFilter, setTypeFilter] = useState<string>(FILTER_ALL);
  const [gasFilter, setGasFilter] = useState<string>(FILTER_ALL);
  const [siteFilter, setSiteFilter] = useState<string>(FILTER_ALL);

  const gasMixLabels: Record<GasMix, string> = {
    AIR: t.gasMixAir,
    NITROX: t.gasMixNitrox,
    TRIMIX: t.gasMixTrimix,
    OXYGEN: t.gasMixOxygen,
  };
  const diveTypeLabels = diveTypeKeyLabels(t);

  const filteredDives = dives.filter((dive) => {
    if (typeFilter !== FILTER_ALL && dive.diveType !== typeFilter) return false;
    if (gasFilter !== FILTER_ALL && dive.gasMix !== gasFilter) return false;
    if (siteFilter !== FILTER_ALL && dive.diveSiteId !== siteFilter) return false;
    return true;
  });
  const hasActiveFilters = typeFilter !== FILTER_ALL || gasFilter !== FILTER_ALL || siteFilter !== FILTER_ALL;
  const clearFilters = () => {
    setTypeFilter(FILTER_ALL);
    setGasFilter(FILTER_ALL);
    setSiteFilter(FILTER_ALL);
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
      <div className="flex flex-wrap items-end justify-between gap-2">
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

        {dives.length > 0 && (
          <div className="flex flex-wrap items-end gap-2">
            <button
              type="button"
              onClick={clearFilters}
              className={`flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors h-8 shrink-0 ${
                hasActiveFilters ? "" : "invisible"
              }`}
            >
              <X className="h-3 w-3" /> {t.clearFiltersLabel}
            </button>
            {sites.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="filterSite" className="text-xs text-muted-foreground">
                  {t.diveSite}
                </Label>
                <Select value={siteFilter} onValueChange={(v) => v !== null && setSiteFilter(v)}>
                  <SelectTrigger id="filterSite" size="sm" className="w-64">
                    <SelectValue>
                      {(value: string) =>
                        value === FILTER_ALL ? t.filterAllLabel : (sites.find((s) => s.id === value)?.name ?? t.filterAllLabel)
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={FILTER_ALL}>{t.filterAllLabel}</SelectItem>
                    {sites.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="filterType" className="text-xs text-muted-foreground">
                {t.diveType}
              </Label>
              <Select value={typeFilter} onValueChange={(v) => v !== null && setTypeFilter(v)}>
                <SelectTrigger id="filterType" size="sm" className="w-40">
                  <SelectValue>
                    {(value: string) => (value === FILTER_ALL ? t.filterAllLabel : diveTypeLabels[value as keyof typeof diveTypeLabels])}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={FILTER_ALL}>{t.filterAllLabel}</SelectItem>
                  {DIVE_TYPE_KEYS.map((key) => (
                    <SelectItem key={key} value={key}>
                      {diveTypeLabels[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="filterGas" className="text-xs text-muted-foreground">
                {t.diveGasMix}
              </Label>
              <Select value={gasFilter} onValueChange={(v) => v !== null && setGasFilter(v)}>
                <SelectTrigger id="filterGas" size="sm" className="w-40">
                  <SelectValue>
                    {(value: string) => (value === FILTER_ALL ? t.filterAllLabel : gasMixLabels[value as GasMix])}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={FILTER_ALL}>{t.filterAllLabel}</SelectItem>
                  <SelectItem value="AIR">{t.gasMixAir}</SelectItem>
                  <SelectItem value="NITROX">{t.gasMixNitrox}</SelectItem>
                  <SelectItem value="TRIMIX">{t.gasMixTrimix}</SelectItem>
                  <SelectItem value="OXYGEN">{t.gasMixOxygen}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      {filteredDives.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-muted-foreground">
            <Waves className="h-8 w-8 mx-auto mb-3 opacity-50" />
            <p>{dives.length === 0 ? t.noDives : t.noDivesFiltered}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredDives.map((dive) => (
            <Card
              key={dive.id}
              id={dive.id}
              className="scroll-mt-16 target:ring-2 target:ring-primary/40 cursor-pointer hover:bg-accent/40 transition-colors"
              role="link"
              tabIndex={0}
              onClick={() => router.push(`/dives/${dive.id}`)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") router.push(`/dives/${dive.id}`);
              }}
            >
              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary">#{dive.diveNumber}</Badge>
                      <span className="font-semibold">{dive.diveSite?.name ?? t.diveSiteNone}</span>
                      {dive.diveType && <Badge variant="outline">{diveTypeLabel(dive.diveType, t)}</Badge>}
                      <Badge variant="outline">{gasMixLabels[dive.gasMix]}</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground space-y-0.5">
                      <p>{formatDiveDate(dive.date, dfLocale)}</p>
                      <p className="flex items-center gap-1">
                        <ArrowDownToLine className="h-3.5 w-3.5" /> {dive.depthMax} m
                        <Timer className="h-3.5 w-3.5 ml-2" /> {dive.bottomTime} min
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
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditing(dive);
                        setOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(dive.id);
                      }}
                    >
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
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `${t.editDive} #${editing.diveNumber}` : t.addDive}</DialogTitle>
          </DialogHeader>
          <DiveLogForm dive={editing ?? undefined} sites={sites} equipment={equipment} onSuccess={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </div>
  );
}
