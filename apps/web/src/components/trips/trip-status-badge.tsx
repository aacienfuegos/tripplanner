import { Badge } from "@/components/ui/badge";
import type { TripStatus } from "@/types";
import type { WebLocale } from "@/i18n";

const labels: Record<WebLocale, Record<TripStatus, string>> = {
  es: {
    PLANNING: "Planificando",
    BOOKED: "Reservado",
    ONGOING: "En curso",
    COMPLETED: "Completado",
    CANCELLED: "Cancelado",
  },
  en: {
    PLANNING: "Planning",
    BOOKED: "Booked",
    ONGOING: "Ongoing",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
  },
};

const variants: Record<TripStatus, "default" | "secondary" | "destructive" | "outline"> = {
  PLANNING: "secondary",
  BOOKED: "default",
  ONGOING: "default",
  COMPLETED: "outline",
  CANCELLED: "destructive",
};

export function TripStatusBadge({ status, locale = "es" }: { status: TripStatus; locale?: WebLocale }) {
  return <Badge variant={variants[status]}>{labels[locale][status]}</Badge>;
}
