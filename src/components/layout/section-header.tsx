import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface SectionHeaderProps {
  tripId: string;
  tripName: string;
  title: string;
  icon: React.ReactNode;
}

export function SectionHeader({ tripId, tripName, title, icon }: SectionHeaderProps) {
  return (
    <div>
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-3">
        <Link href="/trips" className="hover:text-foreground">Viajes</Link>
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
  );
}
