"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useT } from "@/contexts/LanguageContext";

interface Props {
  open: boolean;
  trips: readonly { id: string; name: string }[];
  isPending: boolean;
  onPick: (tripId: string) => void;
  onCancel: () => void;
}

export function CopyFromTripDialog({ open, trips, isPending, onPick, onCancel }: Props) {
  const { t } = useT();
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onCancel(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t.copyPackingFromTrip}</DialogTitle>
          <DialogDescription>{t.copyPackingFromTripHint}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          {trips.map((trip) => (
            <Button
              key={trip.id}
              variant="outline"
              className="justify-start"
              disabled={isPending}
              onClick={() => onPick(trip.id)}
            >
              {trip.name}
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
