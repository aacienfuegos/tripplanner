"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createFlight, updateFlight } from "@/actions/flights";
import type { Flight } from "@/types";
import { format } from "date-fns";
import { useT } from "@/contexts/LanguageContext";

interface FlightFormProps {
  tripId: string;
  flight?: Flight;
  tripStartDate: Date;
  onSuccess: () => void;
}

export function FlightForm({ tripId, flight, tripStartDate, onSuccess }: FlightFormProps) {
  const { t } = useT();
  const [isPending, startTransition] = useTransition();

  const fmtDatetime = (d: Date) => format(d, "yyyy-MM-dd'T'HH:mm");

  const defaultDeparture = flight?.departureAt ? fmtDatetime(flight.departureAt) : fmtDatetime(tripStartDate);
  const [departure, setDeparture] = useState(defaultDeparture);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        if (flight) {
          await updateFlight(tripId, flight.id, formData);
          toast.success(t.flightUpdatedToast);
        } else {
          await createFlight(tripId, formData);
          toast.success(t.flightAddedToast);
        }
        onSuccess();
      } catch {
        toast.error(t.toastErrorSaving);
      }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="airline">{t.flightAirline} *</Label>
          <Input id="airline" name="airline" placeholder="Iberia" defaultValue={flight?.airline ?? ""} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="flightNumber">{t.flightNumber} *</Label>
          <Input id="flightNumber" name="flightNumber" placeholder="IB3170" defaultValue={flight?.flightNumber ?? ""} required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="origin">{t.flightOrigin} *</Label>
          <Input id="origin" name="origin" placeholder="MAD" defaultValue={flight?.origin} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="destination">{t.flightDestination} *</Label>
          <Input id="destination" name="destination" placeholder="NRT" defaultValue={flight?.destination} required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="departureAt">{t.flightDeparture} *</Label>
          <Input
            id="departureAt"
            name="departureAt"
            type="datetime-local"
            value={departure}
            onChange={(e) => setDeparture(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="arrivalAt">{t.flightArrival} *</Label>
          <Input
            key={departure}
            id="arrivalAt"
            name="arrivalAt"
            type="datetime-local"
            defaultValue={flight?.arrivalAt ? fmtDatetime(flight.arrivalAt) : departure}
            required
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="class">{t.flightClass}</Label>
          <Select name="class" defaultValue={flight?.class ?? "ECONOMY"}>
            <SelectTrigger id="class"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ECONOMY">Economy</SelectItem>
              <SelectItem value="PREMIUM_ECONOMY">Premium Economy</SelectItem>
              <SelectItem value="BUSINESS">Business</SelectItem>
              <SelectItem value="FIRST">{t.flightClassFirst}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="seatNumber">{t.seatNumber}</Label>
          <Input id="seatNumber" name="seatNumber" placeholder="12A" defaultValue={flight?.seatNumber ?? ""} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="bookingRef">{t.bookingRef}</Label>
          <Input id="bookingRef" name="bookingRef" placeholder="ABC123" defaultValue={flight?.bookingRef ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="price">{t.price} (€)</Label>
          <Input id="price" name="price" type="number" step="0.01" defaultValue={flight?.price ?? ""} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirmationUrl">{t.confirmationUrlLabel}</Label>
        <Input id="confirmationUrl" name="confirmationUrl" type="url" placeholder="https://..." defaultValue={flight?.confirmationUrl ?? ""} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="notes">{t.notes}</Label>
        <Textarea id="notes" name="notes" rows={2} defaultValue={flight?.notes ?? ""} />
      </div>
      <div className="flex gap-2 pt-1">
        <Button type="submit" disabled={isPending}>
          {isPending ? t.savingEllipsis : flight ? t.saveChanges : t.addFlight}
        </Button>
      </div>
    </form>
  );
}
