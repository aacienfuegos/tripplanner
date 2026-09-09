"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CountrySelect } from "@/components/ui/country-select";
import { createDestination, updateDestination } from "@/actions/destinations";
import type { Destination } from "@/types";
import { format } from "date-fns";
import { useT } from "@/contexts/LanguageContext";

interface DestinationFormProps {
  tripId: string;
  destination?: Destination;
  tripStartDate: Date;
  onSuccess: () => void;
}

export function DestinationForm({ tripId, destination, tripStartDate, onSuccess }: DestinationFormProps) {
  const { t, locale } = useT();
  const [isPending, startTransition] = useTransition();
  const [country, setCountry] = useState<string | undefined>(destination?.country);

  const fmtDate = (d: Date) => format(d, "yyyy-MM-dd");
  const defaultArrival = destination?.arrivalDate ? fmtDate(destination.arrivalDate) : fmtDate(tripStartDate);
  const [arrival, setArrival] = useState(defaultArrival);

  function handleSubmit(formData: FormData) {
    if (!country) {
      toast.error(t.destinationCountryRequired);
      return;
    }
    startTransition(async () => {
      try {
        if (destination) {
          await updateDestination(tripId, destination.id, formData);
          toast.success(t.destinationUpdatedToast);
        } else {
          await createDestination(tripId, formData);
          toast.success(t.destinationAddedToast);
        }
        onSuccess();
      } catch {
        toast.error(t.toastErrorSaving);
      }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="city">{t.city} *</Label>
        <Input id="city" name="city" defaultValue={destination?.city ?? ""} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="country">{t.destinationCountry} *</Label>
        <CountrySelect
          name="country"
          value={country}
          onValueChange={setCountry}
          locale={locale}
          placeholder={t.destinationCountryRequired}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="arrivalDate">{t.destinationArrival} *</Label>
          <Input
            id="arrivalDate"
            name="arrivalDate"
            type="date"
            value={arrival}
            onChange={(e) => setArrival(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="departureDate">{t.destinationDeparture} *</Label>
          <Input
            key={arrival}
            id="departureDate"
            name="departureDate"
            type="date"
            defaultValue={destination?.departureDate ? fmtDate(destination.departureDate) : arrival}
            required
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="notes">{t.notes}</Label>
        <Textarea id="notes" name="notes" rows={2} defaultValue={destination?.notes ?? ""} />
      </div>
      <div className="flex gap-2 pt-1">
        <Button type="submit" disabled={isPending}>
          {isPending ? t.savingEllipsis : destination ? t.saveChanges : t.addDestination}
        </Button>
      </div>
    </form>
  );
}
