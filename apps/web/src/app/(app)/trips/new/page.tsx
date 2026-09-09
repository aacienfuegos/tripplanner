import { TripForm } from "@/components/trips/trip-form";
import { getT } from "@/lib/locale";

export default async function NewTripPage() {
  const t = await getT();
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">{t.newTrip}</h1>
      <TripForm />
    </div>
  );
}
