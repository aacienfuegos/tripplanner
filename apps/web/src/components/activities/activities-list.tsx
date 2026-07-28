"use client";

import { useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es as esLocale, enUS } from "date-fns/locale";
import { Plus, Star, Pencil, Trash2, ExternalLink, MapPin, Clock, Banknote } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { ActivityForm } from "./activity-form";
import { deleteActivity, updateActivityStatus } from "@/actions/activities";
import type { Activity, BookingStatus } from "@/types";
import { cn } from "@/lib/utils";
import { useT } from "@/contexts/LanguageContext";
import { formatCurrency } from "@/lib/currency";

const statusVariants: Record<BookingStatus, "default" | "secondary" | "outline" | "destructive"> = {
  PENDING: "secondary", RESERVED: "default", CONFIRMED: "default", CANCELLED: "destructive",
};
const statusCycle: BookingStatus[] = ["PENDING", "RESERVED", "CONFIRMED", "CANCELLED"];

export function ActivitiesList({ tripId, activities, tripStartDate, currency }: { tripId: string; activities: Activity[]; tripStartDate: Date; currency: string }) {
  const { t } = useT();
  const dfLocale = t.locale === "es" ? esLocale : enUS;
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Activity | null>(null);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();

  const typeLabels: Record<string, string> = {
    ACTIVITY: t.activityTypeActivity,
    RESTAURANT: t.activityTypeRestaurant,
    MUSEUM: t.activityTypeMuseum,
    TOUR: t.activityTypeTour,
    TRANSPORT: t.transportLabel,
    SHOW: t.activityTypeShow,
    OTHER: t.otherLabel,
  };

  const statusLabels: Record<BookingStatus, string> = {
    PENDING: t.statusPending,
    RESERVED: t.statusReserved,
    CONFIRMED: t.statusConfirmed,
    CANCELLED: t.statusCancelled,
  };

  async function handleDelete(id: string) {
    const ok = await confirm({
      title: t.confirmDeleteActivity,
      confirmLabel: t.delete,
      cancelLabel: t.cancel,
      destructive: true,
    });
    if (!ok) return;
    try { await deleteActivity(tripId, id); toast.success(t.deletedToastActivity); }
    catch { toast.error(t.error); }
  }

  async function cycleStatus(activity: Activity) {
    const next = statusCycle[(statusCycle.indexOf(activity.status) + 1) % statusCycle.length];
    try { await updateActivityStatus(tripId, activity.id, next); }
    catch { toast.error(t.error); }
  }

  return (
    <div className="space-y-4">
      <Button onClick={() => { setEditing(null); setOpen(true); }}>
        <Plus className="h-4 w-4 mr-2" /> {t.addActivity}
      </Button>

      {activities.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-muted-foreground">
            <Star className="h-8 w-8 mx-auto mb-3 opacity-50" />
            <p>{t.noActivities}</p>
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
                      {act.scheduledAt && <p>{format(act.scheduledAt, "d MMM yyyy, HH:mm", { locale: dfLocale })}</p>}
                      {act.location && (
                        <p className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" /> {act.location}{act.city && `, ${act.city}`}
                        </p>
                      )}
                      {act.duration && (
                        <p className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" /> {act.duration} min
                        </p>
                      )}
                      {act.price && (
                        <p className="flex items-center gap-1">
                          <Banknote className="h-3.5 w-3.5" /> {formatCurrency(act.price, currency, t.dateLocale)}
                        </p>
                      )}
                      {act.bookingRef && <p>{t.bookingRef}: <span className="font-mono font-medium text-foreground">{act.bookingRef}</span></p>}
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
                        title={t.viewOnGoogleMaps}
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
                    <Button variant="ghost" size="icon" onClick={() => { setEditing(act); setOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
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
            <DialogTitle>{editing ? t.editActivity : t.addActivity}</DialogTitle>
          </DialogHeader>
          <ActivityForm tripId={tripId} activity={editing ?? undefined} tripStartDate={tripStartDate} currency={currency} onSuccess={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </div>
  );
}
