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

interface FlightFormProps {
  tripId: string;
  flight?: Flight;
  tripStartDate: Date;
  onSuccess: () => void;
}

export function FlightForm({ tripId, flight, tripStartDate, onSuccess }: FlightFormProps) {
  const [isPending, startTransition] = useTransition();

  const fmtDatetime = (d: Date) => format(d, "yyyy-MM-dd'T'HH:mm");

  const defaultDeparture = flight ? fmtDatetime(flight.departureAt) : fmtDatetime(tripStartDate);
  const [departure, setDeparture] = useState(defaultDeparture);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        if (flight) {
          await updateFlight(tripId, flight.id, formData);
          toast.success("Vuelo actualizado");
        } else {
          await createFlight(tripId, formData);
          toast.success("Vuelo añadido");
        }
        onSuccess();
      } catch {
        toast.error("Error al guardar");
      }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="airline">Aerolínea *</Label>
          <Input id="airline" name="airline" placeholder="Iberia" defaultValue={flight?.airline} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="flightNumber">Nº vuelo *</Label>
          <Input id="flightNumber" name="flightNumber" placeholder="IB3170" defaultValue={flight?.flightNumber} required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="origin">Origen *</Label>
          <Input id="origin" name="origin" placeholder="MAD" defaultValue={flight?.origin} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="destination">Destino *</Label>
          <Input id="destination" name="destination" placeholder="NRT" defaultValue={flight?.destination} required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="departureAt">Salida *</Label>
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
          <Label htmlFor="arrivalAt">Llegada *</Label>
          <Input
            key={departure}
            id="arrivalAt"
            name="arrivalAt"
            type="datetime-local"
            defaultValue={flight ? fmtDatetime(flight.arrivalAt) : departure}
            required
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="class">Clase</Label>
          <Select name="class" defaultValue={flight?.class ?? "ECONOMY"}>
            <SelectTrigger id="class"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ECONOMY">Economy</SelectItem>
              <SelectItem value="PREMIUM_ECONOMY">Premium Economy</SelectItem>
              <SelectItem value="BUSINESS">Business</SelectItem>
              <SelectItem value="FIRST">Primera</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="seatNumber">Asiento</Label>
          <Input id="seatNumber" name="seatNumber" placeholder="12A" defaultValue={flight?.seatNumber ?? ""} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="bookingRef">Localizador</Label>
          <Input id="bookingRef" name="bookingRef" placeholder="ABC123" defaultValue={flight?.bookingRef ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="price">Precio (€)</Label>
          <Input id="price" name="price" type="number" step="0.01" defaultValue={flight?.price ?? ""} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirmationUrl">URL confirmación</Label>
        <Input id="confirmationUrl" name="confirmationUrl" type="url" placeholder="https://..." defaultValue={flight?.confirmationUrl ?? ""} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="notes">Notas</Label>
        <Textarea id="notes" name="notes" rows={2} defaultValue={flight?.notes ?? ""} />
      </div>
      <div className="flex gap-2 pt-1">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Guardando..." : flight ? "Guardar cambios" : "Añadir vuelo"}
        </Button>
      </div>
    </form>
  );
}
