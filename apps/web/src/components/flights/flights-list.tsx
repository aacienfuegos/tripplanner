"use client";

import { useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es as esLocale, enUS } from "date-fns/locale";
import { Plus, Plane, Pencil, Trash2, ExternalLink, ArrowRight } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { FlightForm } from "./flight-form";
import { deleteFlight } from "@/actions/flights";
import type { Flight } from "@/types";
import { cn } from "@/lib/utils";
import { useT } from "@/contexts/LanguageContext";
import { formatCurrency } from "@/lib/currency";

export function FlightsList({ tripId, flights, tripStartDate, currency }: { tripId: string; flights: Flight[]; tripStartDate: Date; currency: string }) {
  const { t } = useT();
  const dfLocale = t.locale === "es" ? esLocale : enUS;
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Flight | null>(null);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();

  async function handleDelete(flightId: string) {
    const ok = await confirm({
      title: t.confirmDeleteFlight,
      confirmLabel: t.delete,
      cancelLabel: t.cancel,
      destructive: true,
    });
    if (!ok) return;
    try { await deleteFlight(tripId, flightId); toast.success(t.flightDeletedToast); }
    catch { toast.error(t.error); }
  }

  return (
    <div className="space-y-4">
      <Button onClick={() => { setEditing(null); setOpen(true); }}>
        <Plus className="h-4 w-4 mr-2" /> {t.addFlight}
      </Button>

      {flights.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-muted-foreground">
            <Plane className="h-8 w-8 mx-auto mb-3 opacity-50" />
            <p>{t.noFlights}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {flights.map((flight) => (
            <Card key={flight.id} id={flight.id} className="scroll-mt-16 target:ring-2 target:ring-primary/40">
              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-lg">{flight.origin}</span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold text-lg">{flight.destination}</span>
                      <Badge variant="secondary">{flight.class}</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground space-y-0.5">
                      <p>
                        <span className="font-medium text-foreground">{flight.airline}</span>{" "}
                        {flight.flightNumber}
                        {flight.seatNumber && ` · ${t.seatNumber} ${flight.seatNumber}`}
                      </p>
                      {flight.departureAt && <p>{t.flightDeparture}: {format(flight.departureAt, "d MMM yyyy, HH:mm", { locale: dfLocale })}</p>}
                      {flight.arrivalAt && <p>{t.flightArrival}: {format(flight.arrivalAt, "d MMM yyyy, HH:mm", { locale: dfLocale })}</p>}
                      {flight.bookingRef && <p>{t.bookingRef}: <span className="font-mono font-medium text-foreground">{flight.bookingRef}</span></p>}
                      {flight.price && <p>{t.price}: {formatCurrency(flight.price, currency, t.dateLocale)}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {flight.confirmationUrl && (
                      <a
                        href={flight.confirmationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => { setEditing(flight); setOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(flight.id)}>
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
            <DialogTitle>{editing ? t.editFlight : t.addFlight}</DialogTitle>
          </DialogHeader>
          <FlightForm tripId={tripId} flight={editing ?? undefined} tripStartDate={tripStartDate} currency={currency} onSuccess={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </div>
  );
}
