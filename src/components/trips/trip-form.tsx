"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { createTrip, updateTrip } from "@/actions/trips";
import type { Trip } from "@/types";
import { format } from "date-fns";

const CURRENCIES = ["EUR", "USD", "GBP", "JPY", "MXN", "ARS", "CLP", "COP"];

interface TripFormProps {
  trip?: Trip;
}

export function TripForm({ trip }: TripFormProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  async function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        if (trip) {
          await updateTrip(trip.id, formData);
          toast.success("Viaje actualizado");
          router.push(`/trips/${trip.id}`);
        } else {
          await createTrip(formData);
        }
      } catch (error) {
        if (isRedirectError(error)) throw error;
        toast.error("Error al guardar el viaje");
      }
    });
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form action={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre del viaje *</Label>
            <Input
              id="name"
              name="name"
              placeholder="ej. Japón 2025"
              defaultValue={trip?.name}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              name="description"
              placeholder="Una breve descripción del viaje..."
              defaultValue={trip?.description ?? ""}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Fecha de inicio *</Label>
              <Input
                id="startDate"
                name="startDate"
                type="date"
                defaultValue={trip ? format(trip.startDate, "yyyy-MM-dd") : ""}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">Fecha de fin *</Label>
              <Input
                id="endDate"
                name="endDate"
                type="date"
                defaultValue={trip ? format(trip.endDate, "yyyy-MM-dd") : ""}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="currency">Moneda</Label>
              <Select name="currency" defaultValue={trip?.currency ?? "EUR"}>
                <SelectTrigger id="currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="budget">Presupuesto total</Label>
              <Input
                id="budget"
                name="budget"
                type="number"
                step="0.01"
                placeholder="0.00"
                defaultValue={trip?.budget ?? ""}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Guardando..." : trip ? "Guardar cambios" : "Crear viaje"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.back()}
              disabled={isPending}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
