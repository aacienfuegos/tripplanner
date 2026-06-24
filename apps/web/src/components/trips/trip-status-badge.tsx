import { Badge } from "@/components/ui/badge";
import type { TripStatus } from "@/types";

const labels: Record<TripStatus, string> = {
  PLANNING: "Planificando",
  BOOKED: "Reservado",
  ONGOING: "En curso",
  COMPLETED: "Completado",
  CANCELLED: "Cancelado",
};

const variants: Record<TripStatus, "default" | "secondary" | "destructive" | "outline"> = {
  PLANNING: "secondary",
  BOOKED: "default",
  ONGOING: "default",
  COMPLETED: "outline",
  CANCELLED: "destructive",
};

export function TripStatusBadge({ status }: { status: TripStatus }) {
  return <Badge variant={variants[status]}>{labels[status]}</Badge>;
}
