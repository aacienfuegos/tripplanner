"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { format } from "date-fns";
import { es as esLocale, enUS } from "date-fns/locale";
import { Plus, Waves, Link2, Link2Off, MapPin, ArrowDownToLine, Timer } from "lucide-react";
import { countryCodeToName } from "@tripplanner/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DiveLogForm } from "./dive-log-form";
import { linkDiveToTrip, unlinkDiveFromTrip } from "@/actions/dives";
import type { DiveLogWithSite, DiveSite, DiveEquipment } from "@/types";
import { useT } from "@/contexts/LanguageContext";
import { formatDiveDate } from "@/lib/dive-date";

interface Props {
  tripId: string;
  dives: DiveLogWithSite[];
  availableDives: DiveLogWithSite[];
  sites: DiveSite[];
  equipment: DiveEquipment[];
}

export function TripDiveSection({ tripId, dives, availableDives, sites, equipment }: Props) {
  const { t } = useT();
  const dfLocale = t.locale === "es" ? esLocale : enUS;
  const [open, setOpen] = useState(false);
  const [selectedDiveId, setSelectedDiveId] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleLink() {
    if (!selectedDiveId) return;
    startTransition(async () => {
      try {
        await linkDiveToTrip(selectedDiveId, tripId);
        toast.success(t.toastUpdated);
        setSelectedDiveId("");
      } catch {
        toast.error(t.toastErrorSaving);
      }
    });
  }

  function diveOptionLabel(d: DiveLogWithSite) {
    return `#${d.diveNumber} · ${format(d.date, "d MMM yyyy", { locale: dfLocale })}${d.diveSite ? ` · ${d.diveSite.name}` : ""}`;
  }

  function handleUnlink(diveId: string) {
    startTransition(async () => {
      try {
        await unlinkDiveFromTrip(diveId);
        toast.success(t.toastUpdated);
      } catch {
        toast.error(t.toastErrorSaving);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> {t.addDive}
        </Button>

        {availableDives.length > 0 && (
          <div className="flex items-center gap-2">
            <Select value={selectedDiveId} onValueChange={(v) => v !== null && setSelectedDiveId(v)}>
              <SelectTrigger className="w-96">
                <SelectValue placeholder={t.linkDiveSelectPlaceholder}>
                  {(value: string) => {
                    const selected = availableDives.find((d) => d.id === value);
                    return selected ? diveOptionLabel(selected) : t.linkDiveSelectPlaceholder;
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {availableDives.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {diveOptionLabel(d)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" disabled={!selectedDiveId || isPending} onClick={handleLink}>
              <Link2 className="h-4 w-4 mr-2" /> {t.linkDive}
            </Button>
          </div>
        )}
      </div>

      {dives.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-muted-foreground">
            <Waves className="h-8 w-8 mx-auto mb-3 opacity-50" />
            <p>{t.noTripDives}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {dives.map((dive) => (
            <Card key={dive.id} id={dive.id} className="scroll-mt-16 target:ring-2 target:ring-primary/40">
              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-4">
                  <Link href={`/dives#${dive.id}`} className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary">#{dive.diveNumber}</Badge>
                      <span className="font-semibold">{dive.diveSite?.name ?? t.diveSiteNone}</span>
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
                          {[
                            dive.diveSite?.region,
                            dive.diveSite?.country && countryCodeToName(dive.diveSite.country, t.locale),
                          ]
                            .filter(Boolean)
                            .join(", ")}
                        </p>
                      )}
                    </div>
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={isPending}
                    onClick={() => handleUnlink(dive.id)}
                    title={t.unlinkDive}
                  >
                    <Link2Off className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t.addDive}</DialogTitle>
          </DialogHeader>
          <DiveLogForm sites={sites} equipment={equipment} tripId={tripId} onSuccess={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
