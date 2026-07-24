import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { TripNav } from "@/components/trips/trip-nav";
import type { TripNavCounts } from "@/lib/trip-nav-counts";

interface SectionHeaderProps {
  tripId: string;
  tripName: string;
  title: string;
  icon: React.ReactNode;
  counts: TripNavCounts;
  tripsLabel?: string;
}

export function SectionHeader({ tripId, tripName, title, icon, counts, tripsLabel = "Viajes" }: SectionHeaderProps) {
  return (
    <div className="space-y-4">
      <div>
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-3">
          <Link href="/trips" className="hover:text-foreground">{tripsLabel}</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link href={`/trips/${tripId}`} className="hover:text-foreground">{tripName}</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground">{title}</span>
        </nav>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          {icon}
          {title}
        </h1>
      </div>
      <TripNav tripId={tripId} counts={counts} />
    </div>
  );
}
