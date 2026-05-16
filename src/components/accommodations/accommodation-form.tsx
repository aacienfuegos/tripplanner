"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createAccommodation, updateAccommodation } from "@/actions/accommodations";
import type { Accommodation } from "@/types";
import { format } from "date-fns";

interface Props { tripId: string; accommodation?: Accommodation; tripStartDate: Date; onSuccess: () => void; }

export function AccommodationForm({ tripId, accommodation: a, tripStartDate, onSuccess }: Props) {
  const [isPending, startTransition] = useTransition();

  const fmt = (d: Date) => format(d, "yyyy-MM-dd");

  const defaultCheckIn = a ? fmt(a.checkIn) : fmt(tripStartDate);
  const [checkIn, setCheckIn] = useState(defaultCheckIn);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        if (a) { await updateAccommodation(tripId, a.id, formData); toast.success("Actualizado"); }
        else { await createAccommodation(tripId, formData); toast.success("Añadido"); }
        onSuccess();
      } catch { toast.error("Error al guardar"); }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5 col-span-2">
          <Label htmlFor="name">Nombre *</Label>
          <Input id="name" name="name" placeholder="Hotel Madrid" defaultValue={a?.name} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="type">Tipo</Label>
          <Select name="type" defaultValue={a?.type ?? "HOTEL"}>
            <SelectTrigger id="type"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["HOTEL","HOSTEL","AIRBNB","APARTMENT","RESORT","OTHER"].map(t => (
                <SelectItem key={t} value={t}>{t.charAt(0)+t.slice(1).toLowerCase()}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="city">Ciudad *</Label>
          <Input id="city" name="city" placeholder="Madrid" defaultValue={a?.city} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="checkIn">Check-in *</Label>
          <Input
            id="checkIn"
            name="checkIn"
            type="date"
            value={checkIn}
            onChange={(e) => setCheckIn(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="checkOut">Check-out *</Label>
          <Input
            key={checkIn}
            id="checkOut"
            name="checkOut"
            type="date"
            defaultValue={a ? fmt(a.checkOut) : checkIn}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pricePerNight">€/noche</Label>
          <Input id="pricePerNight" name="pricePerNight" type="number" step="0.01" defaultValue={a?.pricePerNight ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="price">Precio total</Label>
          <Input id="price" name="price" type="number" step="0.01" defaultValue={a?.price ?? ""} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="address">Dirección</Label>
        <Input id="address" name="address" defaultValue={a?.address ?? ""} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="bookingRef">Referencia</Label>
          <Input id="bookingRef" name="bookingRef" defaultValue={a?.bookingRef ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirmationUrl">URL confirmación</Label>
          <Input id="confirmationUrl" name="confirmationUrl" type="url" placeholder="https://..." defaultValue={a?.confirmationUrl ?? ""} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="notes">Notas</Label>
        <Textarea id="notes" name="notes" rows={2} defaultValue={a?.notes ?? ""} />
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Guardando..." : a ? "Guardar cambios" : "Añadir alojamiento"}
      </Button>
    </form>
  );
}
