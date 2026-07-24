"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createActivity, updateActivity } from "@/actions/activities";
import type { Activity } from "@/types";
import { format } from "date-fns";
import { useT } from "@/contexts/LanguageContext";

interface Props { tripId: string; activity?: Activity; tripStartDate: Date; onSuccess: () => void; }

export function ActivityForm({ tripId, activity: a, tripStartDate, onSuccess }: Props) {
  const { t } = useT();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        if (a) { await updateActivity(tripId, a.id, formData); toast.success(t.toastUpdated); }
        else { await createActivity(tripId, formData); toast.success(t.toastAdded); }
        onSuccess();
      } catch { toast.error(t.toastErrorSaving); }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5 col-span-2">
          <Label htmlFor="name">{t.nameLabel} *</Label>
          <Input id="name" name="name" required defaultValue={a?.name} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="type">{t.typeLabel}</Label>
          <Select name="type" defaultValue={a?.type ?? "ACTIVITY"}>
            <SelectTrigger id="type"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["ACTIVITY","RESTAURANT","MUSEUM","TOUR","TRANSPORT","SHOW","OTHER"].map(t => (
                <SelectItem key={t} value={t}>{t.charAt(0)+t.slice(1).toLowerCase().replace("_"," ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="status">{t.activityStatus}</Label>
          <Select name="status" defaultValue={a?.status ?? "PENDING"}>
            <SelectTrigger id="status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="PENDING">{t.statusPending}</SelectItem>
              <SelectItem value="RESERVED">{t.statusReserved}</SelectItem>
              <SelectItem value="CONFIRMED">{t.statusConfirmed}</SelectItem>
              <SelectItem value="CANCELLED">{t.statusCancelled}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="scheduledAt">{t.scheduledAt}</Label>
          <Input id="scheduledAt" name="scheduledAt" type="datetime-local"
            defaultValue={a?.scheduledAt ? format(a.scheduledAt, "yyyy-MM-dd'T'HH:mm") : format(tripStartDate, "yyyy-MM-dd'T'HH:mm")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="duration">{t.duration}</Label>
          <Input id="duration" name="duration" type="number" defaultValue={a?.duration ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="location">{t.location}</Label>
          <Input id="location" name="location" defaultValue={a?.location ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="city">{t.city}</Label>
          <Input id="city" name="city" defaultValue={a?.city ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="price">{t.price} (€)</Label>
          <Input id="price" name="price" type="number" step="0.01" defaultValue={a?.price ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bookingRef">{t.bookingRef}</Label>
          <Input id="bookingRef" name="bookingRef" defaultValue={a?.bookingRef ?? ""} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirmationUrl">{t.confirmationUrlLabel}</Label>
        <Input id="confirmationUrl" name="confirmationUrl" type="url" placeholder="https://..." defaultValue={a?.confirmationUrl ?? ""} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="description">{t.descriptionLabel}</Label>
        <Textarea id="description" name="description" rows={2} defaultValue={a?.description ?? ""} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="notes">{t.notes}</Label>
        <Textarea id="notes" name="notes" rows={2} defaultValue={a?.notes ?? ""} />
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? t.savingEllipsis : a ? t.saveChanges : t.addActivity}
      </Button>
    </form>
  );
}
