"use client";

import { useState } from "react";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import { Plus, Hotel, Trash2, ExternalLink, Moon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AccommodationForm } from "./accommodation-form";
import { deleteAccommodation } from "@/actions/accommodations";
import type { Accommodation } from "@/types";
import { cn } from "@/lib/utils";

const typeLabels: Record<string, string> = {
  HOTEL: "Hotel", HOSTEL: "Hostel", AIRBNB: "Airbnb",
  APARTMENT: "Apartamento", RESORT: "Resort", OTHER: "Otro",
};

export function AccommodationsList({ tripId, accommodations, tripStartDate }: { tripId: string; accommodations: Accommodation[]; tripStartDate: Date }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Accommodation | null>(null);

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este alojamiento?")) return;
    try { await deleteAccommodation(tripId, id); toast.success("Eliminado"); }
    catch { toast.error("Error al eliminar"); }
  }

  return (
    <div className="space-y-4">
      <Button onClick={() => { setEditing(null); setOpen(true); }}>
        <Plus className="h-4 w-4 mr-2" /> Añadir alojamiento
      </Button>

      {accommodations.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-muted-foreground">
            <Hotel className="h-8 w-8 mx-auto mb-3 opacity-50" />
            <p>No hay alojamientos registrados</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {accommodations.map((a) => {
            const nights = differenceInDays(a.checkOut, a.checkIn);
            return (
              <Card key={a.id} id={a.id} className="scroll-mt-16 target:ring-2 target:ring-primary/40">
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{a.name}</span>
                        <Badge variant="secondary">{typeLabels[a.type]}</Badge>
                        <span className="text-muted-foreground text-sm">{a.city}</span>
                      </div>
                      <div className="text-sm text-muted-foreground space-y-0.5">
                        <p>Check-in: {format(a.checkIn, "d MMM yyyy", { locale: es })}</p>
                        <p>Check-out: {format(a.checkOut, "d MMM yyyy", { locale: es })}</p>
                        <p className="flex items-center gap-1">
                          <Moon className="h-3 w-3" /> {nights} noche{nights !== 1 ? "s" : ""}
                          {a.pricePerNight && ` · ${a.pricePerNight}€/noche`}
                          {a.price && ` · Total: ${a.price}€`}
                        </p>
                        {a.address && <p>{a.address}</p>}
                        {a.bookingRef && <p>Ref: <span className="font-mono font-medium text-foreground">{a.bookingRef}</span></p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
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
            <DialogTitle>{editing ? "Editar alojamiento" : "Añadir alojamiento"}</DialogTitle>
          </DialogHeader>
          <AccommodationForm tripId={tripId} accommodation={editing ?? undefined} tripStartDate={tripStartDate} onSuccess={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
