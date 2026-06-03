"use client";

import { useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Plus, Star, Trash2, ExternalLink, MapPin } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ActivityForm } from "./activity-form";
import { deleteActivity, updateActivityStatus } from "@/actions/activities";
import type { Activity, BookingStatus } from "@/types";
import { cn } from "@/lib/utils";

const typeLabels: Record<string, string> = {
  ACTIVITY: "Actividad", RESTAURANT: "Restaurante", MUSEUM: "Museo",
  TOUR: "Tour", TRANSPORT: "Transporte", SHOW: "Espectáculo", OTHER: "Otro",
};
const statusLabels: Record<BookingStatus, string> = {
  PENDING: "Pendiente", RESERVED: "Reservado", CONFIRMED: "Confirmado", CANCELLED: "Cancelado",
};
const statusVariants: Record<BookingStatus, "default" | "secondary" | "outline" | "destructive"> = {
  PENDING: "secondary", RESERVED: "default", CONFIRMED: "default", CANCELLED: "destructive",
};
const statusCycle: BookingStatus[] = ["PENDING", "RESERVED", "CONFIRMED", "CANCELLED"];

export function ActivitiesList({ tripId, activities, tripStartDate }: { tripId: string; activities: Activity[]; tripStartDate: Date }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Activity | null>(null);

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta actividad?")) return;
    try { await deleteActivity(tripId, id); toast.success("Eliminada"); }
    catch { toast.error("Error al eliminar"); }
  }

  async function cycleStatus(activity: Activity) {
    const next = statusCycle[(statusCycle.indexOf(activity.status) + 1) % statusCycle.length];
    try { await updateActivityStatus(tripId, activity.id, next); }
    catch { toast.error("Error"); }
  }

  return (
    <div className="space-y-4">
      <Button onClick={() => { setEditing(null); setOpen(true); }}>
        <Plus className="h-4 w-4 mr-2" /> Añadir actividad
      </Button>

      {activities.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-muted-foreground">
            <Star className="h-8 w-8 mx-auto mb-3 opacity-50" />
            <p>No hay actividades registradas</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {activities.map((act) => (
            <Card key={act.id} id={act.id} className="scroll-mt-16 target:ring-2 target:ring-primary/40">
              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{act.name}</span>
                      <Badge variant="outline">{typeLabels[act.type]}</Badge>
                      <button onClick={() => cycleStatus(act)}>
                        <Badge variant={statusVariants[act.status]} className="cursor-pointer">
                          {statusLabels[act.status]}
                        </Badge>
                      </button>
                    </div>
                    <div className="text-sm text-muted-foreground space-y-0.5">
                      {act.scheduledAt && <p>{format(act.scheduledAt, "d MMM yyyy, HH:mm", { locale: es })}</p>}
                      {act.location && <p>📍 {act.location}{act.city && `, ${act.city}`}</p>}
                      {act.duration && <p>⏱ {act.duration} min</p>}
                      {act.price && <p>💶 {act.price}€</p>}
                      {act.bookingRef && <p>Ref: <span className="font-mono font-medium text-foreground">{act.bookingRef}</span></p>}
                      {act.description && <p className="italic">{act.description}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {(act.location || act.city) && (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([act.location, act.city].filter(Boolean).join(", "))}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
                        title="Ver en Google Maps"
                      >
                        <MapPin className="h-4 w-4 text-blue-500" />
                      </a>
                    )}
                    {act.confirmationUrl && (
                      <a
                        href={act.confirmationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => { setEditing(act); setOpen(true); }}>✏️</Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(act.id)}>
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
            <DialogTitle>{editing ? "Editar actividad" : "Añadir actividad"}</DialogTitle>
          </DialogHeader>
          <ActivityForm tripId={tripId} activity={editing ?? undefined} tripStartDate={tripStartDate} onSuccess={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
