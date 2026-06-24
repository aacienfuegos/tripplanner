import { TripForm } from "@/components/trips/trip-form";

export default function NewTripPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Nuevo viaje</h1>
      <TripForm />
    </div>
  );
}
