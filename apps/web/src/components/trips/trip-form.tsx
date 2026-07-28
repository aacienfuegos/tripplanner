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
import { useT } from "@/contexts/LanguageContext";
import { CURRENCIES } from "@/lib/exchangeRate";

interface TripFormProps {
  trip?: Trip;
}

export function TripForm({ trip }: TripFormProps) {
  const { t } = useT();
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  async function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        if (trip) {
          await updateTrip(trip.id, formData);
          toast.success(t.locale === "es" ? "Viaje actualizado" : "Trip updated");
          router.push(`/trips/${trip.id}`);
        } else {
          await createTrip(formData);
        }
      } catch (error) {
        if (isRedirectError(error)) throw error;
        toast.error(t.locale === "es" ? "Error al guardar el viaje" : "Error saving trip");
      }
    });
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form action={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="name">{t.tripName} *</Label>
            <Input
              id="name"
              name="name"
              placeholder={t.locale === "es" ? "ej. Japón 2025" : "e.g. Japan 2025"}
              defaultValue={trip?.name}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">{t.tripDescription}</Label>
            <Textarea
              id="description"
              name="description"
              placeholder={t.tripDescriptionPlaceholder}
              defaultValue={trip?.description ?? ""}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">{t.startDate} *</Label>
              <Input
                id="startDate"
                name="startDate"
                type="date"
                defaultValue={trip ? format(trip.startDate, "yyyy-MM-dd") : ""}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">{t.endDate} *</Label>
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
              <Label htmlFor="currency">{t.tripCurrency}</Label>
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
              <Label htmlFor="budget">{t.tripBudget}</Label>
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
              {isPending
                ? (t.locale === "es" ? "Guardando..." : "Saving...")
                : trip ? t.updateTrip : t.createTrip}
            </Button>
            <Button type="button" variant="ghost" onClick={() => router.back()} disabled={isPending}>
              {t.cancel}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
