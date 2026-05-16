import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Plane, Hotel, Star, FileText, DollarSign, ShoppingBag, MapPin,
  Calendar, Pencil, Clock, CheckCircle2, Circle, AlertCircle,
  Utensils, Landmark, Navigation, Ticket, Package,
} from "lucide-react";
import { format, differenceInDays, startOfDay, addDays, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { TripStatusBadge } from "@/components/trips/trip-status-badge";
import type { Flight, Accommodation, Activity } from "@prisma/client";

// ─── Timeline types ──────────────────────────────────────────────────────────

type FlightEvent    = { type: "flight";        role: "departure" | "arrival"; data: Flight };
type AccomEvent     = { type: "accommodation"; role: "checkin"   | "checkout"; data: Accommodation };
type ActivityEvent  = { type: "activity";      data: Activity };
type DayEvent       = FlightEvent | AccomEvent | ActivityEvent;

type TimelineDay = {
  date: Date;
  dayNumber: number;
  city: string | null;
  events: DayEvent[];
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function eventTime(e: DayEvent): Date {
  if (e.type === "flight")        return e.role === "departure" ? e.data.departureAt : e.data.arrivalAt;
  if (e.type === "accommodation") return e.data.checkIn;
  return e.data.scheduledAt ?? new Date(0);
}

function cityForDay(
  date: Date,
  destinations: { city: string; arrivalDate: Date; departureDate: Date }[],
): string | null {
  for (const d of destinations) {
    if (date >= startOfDay(d.arrivalDate) && date <= startOfDay(d.departureDate)) return d.city;
  }
  return null;
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function TripDetailPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const session = await auth();

  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      destinations:   { orderBy: { order: "asc" } },
      flights:        { orderBy: { departureAt: "asc" } },
      accommodations: { orderBy: { checkIn: "asc" } },
      activities:     { orderBy: { scheduledAt: "asc" } },
      expenses:       { select: { amount: true } },
      _count:         { select: { documents: true, packingItems: true } },
    },
  });

  if (!trip || trip.userId !== session!.user!.id) notFound();

  // ── Build timeline ──────────────────────────────────────────────────────

  const tripStart = startOfDay(trip.startDate);
  const tripEnd   = startOfDay(trip.endDate);
  const totalDays = differenceInDays(tripEnd, tripStart) + 1;

  const days: TimelineDay[] = Array.from({ length: totalDays }, (_, i) => {
    const date = addDays(tripStart, i);
    const events: DayEvent[] = [];

    for (const f of trip.flights) {
      if (isSameDay(f.departureAt, date))
        events.push({ type: "flight", role: "departure", data: f });
      else if (isSameDay(f.arrivalAt, date))
        events.push({ type: "flight", role: "arrival",   data: f });
    }

    for (const a of trip.accommodations) {
      if (isSameDay(a.checkIn,  date)) events.push({ type: "accommodation", role: "checkin",  data: a });
      if (isSameDay(a.checkOut, date)) events.push({ type: "accommodation", role: "checkout", data: a });
    }

    for (const act of trip.activities) {
      if (act.scheduledAt && isSameDay(act.scheduledAt, date))
        events.push({ type: "activity", data: act });
    }

    events.sort((a, b) => eventTime(a).getTime() - eventTime(b).getTime());

    return { date, dayNumber: i + 1, city: cityForDay(date, trip.destinations), events };
  });

  const undatedActivities = trip.activities.filter((a) => !a.scheduledAt);

  // ── Quick stats ─────────────────────────────────────────────────────────

  const totalExpenses   = trip.expenses.reduce((s, e) => s + e.amount, 0);
  const budgetPct       = trip.budget ? Math.min(100, (totalExpenses / trip.budget) * 100) : null;
  const confirmedActs   = trip.activities.filter((a) => a.status === "CONFIRMED" || a.status === "RESERVED").length;
  const pendingActs     = trip.activities.filter((a) => a.status === "PENDING").length;
  const today           = startOfDay(new Date());
  const daysUntilTrip   = differenceInDays(tripStart, today);
  const isOngoing       = today >= tripStart && today <= tripEnd;

  const sections = [
    { href: "flights",        label: "Vuelos",      icon: Plane,       count: trip.flights.length },
    { href: "accommodations", label: "Alojamiento", icon: Hotel,       count: trip.accommodations.length },
    { href: "activities",     label: "Actividades", icon: Star,        count: trip.activities.length },
    { href: "documents",      label: "Documentos",  icon: FileText,    count: trip._count.documents },
    { href: "expenses",       label: "Gastos",      icon: DollarSign,  count: trip.expenses.length },
    { href: "packing",        label: "Equipaje",    icon: ShoppingBag, count: trip._count.packingItems },
  ];

  return (
    <div className="space-y-6">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold">{trip.name}</h1>
            <TripStatusBadge status={trip.status} />
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {format(trip.startDate, "d MMM", { locale: es })} —{" "}
              {format(trip.endDate, "d MMM yyyy", { locale: es })}
              <Badge variant="outline" className="ml-1 text-xs">{totalDays} días</Badge>
            </span>
            {trip.destinations.length > 0 && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {trip.destinations.map((d) => d.city).join(" → ")}
              </span>
            )}
          </div>
          {trip.description && (
            <p className="text-sm text-muted-foreground">{trip.description}</p>
          )}
        </div>
        <Link href={`/trips/${trip.id}/edit`} className={buttonVariants({ variant: "outline", size: "sm" })}>
          <Pencil className="h-3.5 w-3.5 mr-1.5" />
          Editar
        </Link>
      </div>

      {/* ── Quick stats ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Countdown / progress */}
        <Card>
          <CardContent className="pt-3 pb-3">
            <p className="text-xs text-muted-foreground mb-0.5">
              {isOngoing ? "En curso" : daysUntilTrip > 0 ? "Faltan" : "Hace"}
            </p>
            {isOngoing ? (
              <p className="text-sm font-semibold">
                Día {differenceInDays(today, tripStart) + 1} de {totalDays}
              </p>
            ) : (
              <p className="text-2xl font-bold leading-none">
                {Math.abs(daysUntilTrip)}
                <span className="text-sm font-normal text-muted-foreground ml-1">días</span>
              </p>
            )}
          </CardContent>
        </Card>

        {/* Budget */}
        <Card>
          <CardContent className="pt-3 pb-3">
            <p className="text-xs text-muted-foreground mb-0.5">
              {trip.budget ? "Presupuesto" : "Gastos"}
            </p>
            {trip.budget ? (
              <>
                <p className="text-sm font-semibold leading-snug">
                  {totalExpenses.toLocaleString("es-ES", { maximumFractionDigits: 0 })}
                  {" / "}
                  {trip.budget.toLocaleString("es-ES", { maximumFractionDigits: 0 })} {trip.currency}
                </p>
                <div className="mt-1.5 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      budgetPct! > 90 ? "bg-destructive" :
                      budgetPct! > 70 ? "bg-yellow-500" :
                      "bg-green-500"
                    }`}
                    style={{ width: `${budgetPct}%` }}
                  />
                </div>
              </>
            ) : (
              <p className="text-2xl font-bold leading-none">
                {totalExpenses.toLocaleString("es-ES", { maximumFractionDigits: 0 })}
                <span className="text-sm font-normal text-muted-foreground ml-1">{trip.currency}</span>
              </p>
            )}
          </CardContent>
        </Card>

        {/* Flights */}
        <Card>
          <CardContent className="pt-3 pb-3">
            <p className="text-xs text-muted-foreground mb-0.5">Vuelos</p>
            <div className="flex items-baseline gap-1.5">
              <p className="text-2xl font-bold leading-none">{trip.flights.length}</p>
              {trip.flights.length === 0 && (
                <span className="text-xs text-muted-foreground">sin añadir</span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Activities */}
        <Card>
          <CardContent className="pt-3 pb-3">
            <p className="text-xs text-muted-foreground mb-0.5">Actividades</p>
            <div className="flex items-baseline gap-2 flex-wrap">
              <p className="text-2xl font-bold leading-none">{trip.activities.length}</p>
              {pendingActs > 0 && (
                <Badge variant="outline" className="text-xs border-yellow-300 text-yellow-600 px-1 h-4">
                  {pendingActs} pendientes
                </Badge>
              )}
              {confirmedActs > 0 && pendingActs === 0 && (
                <Badge variant="outline" className="text-xs border-green-300 text-green-600 px-1 h-4">
                  todo reservado
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Section navigation ───────────────────────────────────────────── */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {sections.map(({ href, label, icon: Icon, count }) => (
          <Link
            key={href}
            href={`/trips/${trip.id}/${href}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <Icon className="h-3.5 w-3.5 mr-1.5 shrink-0" />
            <span className="shrink-0">{label}</span>
            {count > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-xs h-4 px-1 shrink-0">{count}</Badge>
            )}
          </Link>
        ))}
      </div>

      {/* ── Timeline ────────────────────────────────────────────────────── */}
      <div>
        <h2 className="font-semibold mb-4">Cronología del viaje</h2>

        <div>
          {days.map((day, index) => {
            const isToday  = isSameDay(day.date, today);
            const isPast   = day.date < today && !isToday;
            const isLast   = index === days.length - 1;

            return (
              <div key={day.dayNumber} className="flex gap-3">
                {/* Spine */}
                <div className="flex flex-col items-center w-6 shrink-0">
                  <div className={`mt-1.5 w-2.5 h-2.5 rounded-full border-2 shrink-0 ${
                    isToday  ? "bg-primary border-primary ring-2 ring-primary/20" :
                    isPast   ? "bg-muted-foreground/40 border-muted-foreground/40" :
                               "bg-background border-border"
                  }`} />
                  {!isLast && <div className="w-px flex-1 bg-border mt-1" />}
                </div>

                {/* Day content */}
                <div className="pb-5 flex-1 min-w-0">
                  {/* Day header */}
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className={`text-sm font-semibold ${isPast ? "text-muted-foreground" : ""}`}>
                      Día {day.dayNumber}
                    </span>
                    <span className="text-xs text-muted-foreground capitalize">
                      {format(day.date, "EEEE d MMM", { locale: es })}
                    </span>
                    {isToday && (
                      <Badge className="text-xs px-1.5 h-4 shrink-0">Hoy</Badge>
                    )}
                    {day.city && (
                      <Badge variant="outline" className="text-xs px-1.5 h-4 shrink-0">
                        <MapPin className="h-2.5 w-2.5 mr-0.5" />
                        {day.city}
                      </Badge>
                    )}
                  </div>

                  {/* Events */}
                  {day.events.length > 0 ? (
                    <div className="space-y-1">
                      {day.events.map((event, ei) => (
                        <EventRow key={ei} event={event} tripId={trip.id} />
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground/60 italic">Sin eventos planificados</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Undated activities */}
        {undatedActivities.length > 0 && (
          <div className="mt-2 p-3 border border-dashed rounded-lg">
            <p className="text-xs font-medium text-muted-foreground mb-2">Sin fecha asignada</p>
            <div className="space-y-1">
              {undatedActivities.map((act) => (
                <EventRow key={act.id} event={{ type: "activity", data: act }} tripId={trip.id} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const ACTIVITY_ICONS: Record<string, React.ElementType> = {
  RESTAURANT: Utensils,
  MUSEUM:     Landmark,
  TRANSPORT:  Navigation,
  SHOW:       Ticket,
  TOUR:       Package,
  ACTIVITY:   Star,
  OTHER:      Star,
};

function EventRow({ event, tripId }: { event: DayEvent; tripId: string }) {
  const href =
    event.type === "flight"        ? `/trips/${tripId}/flights#${event.data.id}` :
    event.type === "accommodation" ? `/trips/${tripId}/accommodations#${event.data.id}` :
                                     `/trips/${tripId}/activities#${event.data.id}`;

  if (event.type === "flight") {
    const { data: f, role } = event;
    const time = role === "departure" ? f.departureAt : f.arrivalAt;
    return (
      <Link href={href} className="flex items-center gap-2 text-xs py-1 px-2 rounded bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 hover:brightness-95 transition-[filter]">
        <Plane className={`h-3 w-3 text-blue-600 shrink-0 ${role === "arrival" ? "scale-x-[-1]" : ""}`} />
        <span className="font-medium text-blue-700 dark:text-blue-400 shrink-0">
          {role === "departure" ? "Salida" : "Llegada"}
        </span>
        <span className="text-muted-foreground truncate">
          {f.airline} {f.flightNumber} · {f.origin} → {f.destination}
        </span>
        <span className="text-muted-foreground shrink-0 ml-auto font-mono">
          {format(time, "HH:mm")}
        </span>
        <ConfirmBadge confirmed={!!f.bookingRef} />
      </Link>
    );
  }

  if (event.type === "accommodation") {
    const { data: a, role } = event;
    return (
      <Link href={href} className="flex items-center gap-2 text-xs py-1 px-2 rounded bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900 hover:brightness-95 transition-[filter]">
        <Hotel className="h-3 w-3 text-emerald-600 shrink-0" />
        <span className="font-medium text-emerald-700 dark:text-emerald-400 shrink-0">
          {role === "checkin" ? "Check-in" : "Check-out"}
        </span>
        <span className="text-muted-foreground truncate">{a.name}</span>
        {a.city && <span className="text-muted-foreground shrink-0 hidden sm:block">· {a.city}</span>}
        <ConfirmBadge confirmed={!!a.bookingRef} className="ml-auto" />
      </Link>
    );
  }

  // activity
  const { data: act } = event;
  const Icon = ACTIVITY_ICONS[act.type] ?? Star;
  const rowColor = {
    CONFIRMED: "bg-emerald-50 border-emerald-100 dark:bg-emerald-950/30 dark:border-emerald-900",
    RESERVED:  "bg-emerald-50 border-emerald-100 dark:bg-emerald-950/30 dark:border-emerald-900",
    PENDING:   "bg-amber-50   border-amber-100   dark:bg-amber-950/30   dark:border-amber-900",
    CANCELLED: "bg-muted border-border opacity-50",
  }[act.status];

  return (
    <Link href={href} className={`flex items-center gap-2 text-xs py-1 px-2 rounded border hover:brightness-95 transition-[filter] ${rowColor}`}>
      <Icon className="h-3 w-3 text-amber-500 shrink-0" />
      <span className="font-medium truncate">{act.name}</span>
      {act.scheduledAt && (
        <span className="text-muted-foreground shrink-0 font-mono">
          <Clock className="h-2.5 w-2.5 inline mr-0.5" />
          {format(act.scheduledAt, "HH:mm")}
        </span>
      )}
      {act.location && (
        <span className="text-muted-foreground shrink-0 hidden sm:block">
          <MapPin className="h-2.5 w-2.5 inline mr-0.5" />
          {act.location}
        </span>
      )}
      <ActivityStatusBadge status={act.status} className="ml-auto shrink-0" />
    </Link>
  );
}

function ConfirmBadge({ confirmed, className = "" }: { confirmed: boolean; className?: string }) {
  if (confirmed) {
    return (
      <Badge variant="secondary" className={`text-xs h-4 px-1 shrink-0 ${className}`}>
        <CheckCircle2 className="h-2.5 w-2.5 mr-0.5 text-green-600" />
        Confirmado
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className={`text-xs h-4 px-1 shrink-0 border-yellow-300 text-yellow-600 ${className}`}>
      <Circle className="h-2.5 w-2.5 mr-0.5" />
      Sin confirmar
    </Badge>
  );
}

function ActivityStatusBadge({ status, className = "" }: { status: string; className?: string }) {
  const configs: Record<string, { label: string; icon: React.ElementType; cls: string }> = {
    CONFIRMED: { label: "Confirmado", icon: CheckCircle2, cls: "border-green-300  text-green-600" },
    RESERVED:  { label: "Reservado",  icon: CheckCircle2, cls: "border-green-300  text-green-600" },
    PENDING:   { label: "Pendiente",  icon: Circle,       cls: "border-yellow-300 text-yellow-600" },
    CANCELLED: { label: "Cancelado",  icon: AlertCircle,  cls: "text-muted-foreground" },
  };
  const cfg = configs[status];
  if (!cfg) return null;
  const Icon = cfg.icon;
  return (
    <Badge variant="outline" className={`text-xs h-4 px-1 ${cfg.cls} ${className}`}>
      <Icon className="h-2.5 w-2.5 mr-0.5" />
      {cfg.label}
    </Badge>
  );
}
