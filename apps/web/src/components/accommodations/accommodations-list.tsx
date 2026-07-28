"use client";

import { useState } from "react";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";
import { es as esLocale, enUS } from "date-fns/locale";
import { Plus, Hotel, Trash2, ExternalLink, Moon, MapPin } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AccommodationForm } from "./accommodation-form";
import { deleteAccommodation } from "@/actions/accommodations";
import type { Accommodation } from "@/types";
import { cn } from "@/lib/utils";
import { useT } from "@/contexts/LanguageContext";
import { formatCurrency } from "@/lib/currency";

export function AccommodationsList({ tripId, accommodations, tripStartDate, currency }: { tripId: string; accommodations: Accommodation[]; tripStartDate: Date; currency: string }) {
  const { t } = useT();
  const dfLocale = t.locale === "es" ? esLocale : enUS;
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Accommodation | null>(null);

  async function handleDelete(id: string) {
    if (!confirm(t.locale === "es" ? "¿Eliminar este alojamiento?" : "Delete this accommodation?")) return;
    try { await deleteAccommodation(tripId, id); toast.success(t.locale === "es" ? "Eliminado" : "Deleted"); }
    catch { toast.error(t.error); }
  }

  return (
    <div className="space-y-4">
      <Button onClick={() => { setEditing(null); setOpen(true); }}>
        <Plus className="h-4 w-4 mr-2" /> {t.addAccommodation}
      </Button>

      {accommodations.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-muted-foreground">
            <Hotel className="h-8 w-8 mx-auto mb-3 opacity-50" />
            <p>{t.noAccommodations}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {accommodations.map((a) => {
            const nights = a.checkIn && a.checkOut ? differenceInDays(a.checkOut, a.checkIn) : null;
            return (
              <Card key={a.id} id={a.id} className="scroll-mt-16 target:ring-2 target:ring-primary/40">
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{a.name}</span>
                        <Badge variant="secondary">{a.type}</Badge>
                        <span className="text-muted-foreground text-sm">{a.city}</span>
                      </div>
                      <div className="text-sm text-muted-foreground space-y-0.5">
                        {a.checkIn && <p>{t.checkInDate}: {format(a.checkIn, "d MMM yyyy", { locale: dfLocale })}</p>}
                        {a.checkOut && <p>{t.checkOutDate}: {format(a.checkOut, "d MMM yyyy", { locale: dfLocale })}</p>}
                        <p className="flex items-center gap-1">
                          {nights !== null && (
                            <>
                              <Moon className="h-3 w-3" />
                              {nights} {t.locale === "es" ? `noche${nights !== 1 ? "s" : ""}` : `night${nights !== 1 ? "s" : ""}`}
                            </>
                          )}
                          {a.pricePerNight && ` · ${formatCurrency(a.pricePerNight, currency, t.dateLocale)}/${t.locale === "es" ? "noche" : "night"}`}
                          {a.price && ` · ${t.locale === "es" ? "Total" : "Total"}: ${formatCurrency(a.price, currency, t.dateLocale)}`}
                        </p>
                        {a.address && <p>{a.address}</p>}
                        {a.bookingRef && <p>{t.bookingRef}: <span className="font-mono font-medium text-foreground">{a.bookingRef}</span></p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {(a.address || a.city) && (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([a.name, a.address, a.city].filter(Boolean).join(", "))}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
                          title={t.locale === "es" ? "Ver en Google Maps" : "View on Google Maps"}
                        >
                          <MapPin className="h-4 w-4 text-blue-500" />
                        </a>
                      )}
                      {a.confirmationUrl && (
                        <a
                          href={a.confirmationUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => { setEditing(a); setOpen(true); }}>✏️</Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(a.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? t.editAccommodation : t.addAccommodation}</DialogTitle>
          </DialogHeader>
          <AccommodationForm tripId={tripId} accommodation={editing ?? undefined} tripStartDate={tripStartDate} currency={currency} onSuccess={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
