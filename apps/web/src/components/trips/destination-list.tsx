"use client";

import { useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es as esLocale, enUS } from "date-fns/locale";
import { countryCodeToName } from "@tripplanner/shared";
import { Plus, MapPin, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { DestinationForm } from "./destination-form";
import { deleteDestination } from "@/actions/destinations";
import type { Destination } from "@/types";
import { useT } from "@/contexts/LanguageContext";

export function DestinationList({ tripId, destinations, tripStartDate }: { tripId: string; destinations: Destination[]; tripStartDate: Date }) {
  const { t, locale } = useT();
  const dfLocale = locale === "es" ? esLocale : enUS;
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Destination | null>(null);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();

  async function handleDelete(destinationId: string) {
    const ok = await confirm({
      title: t.confirmDeleteDestination,
      confirmLabel: t.delete,
      cancelLabel: t.cancel,
      destructive: true,
    });
    if (!ok) return;
    try { await deleteDestination(tripId, destinationId); toast.success(t.destinationDeletedToast); }
    catch { toast.error(t.error); }
  }

  return (
    <div className="space-y-4">
      <Button onClick={() => { setEditing(null); setOpen(true); }}>
        <Plus className="h-4 w-4 mr-2" /> {t.addDestination}
      </Button>

      {destinations.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-muted-foreground">
            <MapPin className="h-8 w-8 mx-auto mb-3 opacity-50" />
            <p>{t.noDestinations}</p>
            <p className="text-xs mt-1">{t.noDestinationsHint}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {destinations.map((destination) => (
            <Card key={destination.id} id={destination.id} className="scroll-mt-16 target:ring-2 target:ring-primary/40">
              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-lg">{destination.city}</span>
                      <span className="text-sm text-muted-foreground">{countryCodeToName(destination.country, locale)}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {format(destination.arrivalDate, "d MMM yyyy", { locale: dfLocale })}
                      {" — "}
                      {format(destination.departureDate, "d MMM yyyy", { locale: dfLocale })}
                    </p>
                    {destination.notes && (
                      <p className="text-sm text-muted-foreground italic">{destination.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => { setEditing(destination); setOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(destination.id)}>
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? t.editDestination : t.addDestination}</DialogTitle>
          </DialogHeader>
          <DestinationForm tripId={tripId} destination={editing ?? undefined} tripStartDate={tripStartDate} onSuccess={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </div>
  );
}
