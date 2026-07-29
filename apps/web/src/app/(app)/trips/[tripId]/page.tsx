import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Plane, Hotel, Star, MapPin,
  Calendar, Pencil, Clock, CheckCircle2, Circle, AlertCircle,
  Utensils, Landmark, Navigation, Ticket, Package,
} from "lucide-react";
import { format, differenceInDays, startOfDay, addDays, isSameDay } from "date-fns";
import { es as esLocale, enUS } from "date-fns/locale";
import { TripStatusBadge } from "@/components/trips/trip-status-badge";
import { TripNav } from "@/components/trips/trip-nav";
import { ImportTrigger } from "@/components/import/ImportTrigger";
import { getT } from "@/lib/locale";
import { formatCurrency } from "@/lib/currency";
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
  if (e.type === "flight")        return (e.role === "departure" ? e.data.departureAt : e.data.arrivalAt) ?? new Date(0);
  if (e.type === "accommodation") return e.data.checkIn ?? new Date(0);
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

  const [trip, t] = await Promise.all([
    prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        destinations:   { orderBy: { order: "asc" } },
        flights:        { orderBy: { departureAt: "asc" } },
        accommodations: { orderBy: { checkIn: "asc" } },
        activities:     { orderBy: { scheduledAt: "asc" } },
        expenses:       { select: { amount: true, currency: true, convertedAmount: true } },
        packingItems:   { select: { packed: true } },
        _count:         { select: { documents: true, tasks: true, diveLogs: true } },
      },
    }),
    getT(),
  ]);

  if (!trip || trip.userId !== session!.user!.id) notFound();

  const dfLocale = t.locale === "es" ? esLocale : enUS;
  const agentosEnabled = !!(process.env.AGENTOS_URL && process.env.AGENTOS_API_KEY);

  // ── Build timeline ──────────────────────────────────────────────────────

  const tripStart = startOfDay(trip.startDate);
  const tripEnd   = startOfDay(trip.endDate);
  const totalDays = differenceInDays(tripEnd, tripStart) + 1;

  const days: TimelineDay[] = Array.from({ length: totalDays }, (_, i) => {
    const date = addDays(tripStart, i);
    const events: DayEvent[] = [];

    for (const f of trip.flights) {
      if (f.departureAt && isSameDay(f.departureAt, date))
        events.push({ type: "flight", role: "departure", data: f });
      else if (f.arrivalAt && isSameDay(f.arrivalAt, date))
        events.push({ type: "flight", role: "arrival",   data: f });
    }

    for (const a of trip.accommodations) {
      if (a.checkIn  && isSameDay(a.checkIn,  date)) events.push({ type: "accommodation", role: "checkin",  data: a });
      if (a.checkOut && isSameDay(a.checkOut, date)) events.push({ type: "accommodation", role: "checkout", data: a });
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

  const totalExpenses    = trip.expenses.reduce(
    (s, e) => s + (e.currency === trip.currency ? e.amount : (e.convertedAmount ?? e.amount)),
    0
  );
  const budgetPct        = trip.budget ? Math.min(100, (totalExpenses / trip.budget) * 100) : null;
  const confirmedActs    = trip.activities.filter((a) => a.status === "CONFIRMED" || a.status === "RESERVED").length;
  const pendingActs      = trip.activities.filter((a) => a.status === "PENDING").length;
  const today            = startOfDay(new Date());
  const daysUntilTrip    = differenceInDays(tripStart, today);
  const isOngoing        = today >= tripStart && today <= tripEnd;
  const isPast           = today > tripEnd;
  const daysElapsed      = isOngoing ? differenceInDays(today, tripStart) + 1 : isPast ? totalDays : 0;
  const countdownPct     = (daysElapsed / totalDays) * 100;
  const packedItems      = trip.packingItems.filter((i) => i.packed).length;
  const totalPackItems   = trip.packingItems.length;

  const navCounts = {
    flights: trip.flights.length,
    accommodations: trip.accommodations.length,
    activities: trip.activities.length,
    expenses: trip.expenses.length,
    packingItems: totalPackItems,
    documents: trip._count.documents,
    tasks: trip._count.tasks,
    dives: trip._count.diveLogs,
  };

  const hasQuickStatus =
    (trip.budget !== null && trip.budget > 0) ||
    totalPackItems > 0 ||
    trip.activities.length > 0;

  return (
    <div className="space-y-6">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-4xl font-bold tracking-tight leading-none">{trip.name}</h1>
              <TripStatusBadge status={trip.status} locale={t.locale} />
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 shrink-0" />
                <span className="font-mono text-xs">
                  {format(trip.startDate, "dd MMM yyyy", { locale: dfLocale })}
                  {" — "}
                  {format(trip.endDate, "dd MMM yyyy", { locale: dfLocale })}
                </span>
                <Badge variant="outline" className="text-xs">
                  {totalDays} {totalDays === 1 ? t.day : t.days}
                </Badge>
              </span>
              {trip.destinations.length > 0 && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span className="text-sm">{trip.destinations.map((d) => d.city).join(" → ")}</span>
                </span>
              )}
            </div>
            {trip.description && (
              <p className="text-sm text-muted-foreground">{trip.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ImportTrigger
              tripId={trip.id}
              tripStartDate={trip.startDate.toISOString()}
              tripEndDate={trip.endDate.toISOString()}
              agentosEnabled={agentosEnabled}
            />
            <Link href={`/trips/${trip.id}/edit`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
              {t.editBtn}
            </Link>
          </div>
        </div>

        {/* Countdown progress bar */}
        {(isOngoing || isPast) && (
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground/60 font-mono">
                {format(trip.startDate, "d MMM", { locale: dfLocale })}
              </span>
              <span className="text-xs text-muted-foreground font-medium">
                {isOngoing
                  ? t.dayOf(daysElapsed, totalDays)
                  : t.tripCompleted}
              </span>
              <span className="text-xs text-muted-foreground/60 font-mono">
                {format(trip.endDate, "d MMM", { locale: dfLocale })}
              </span>
            </div>
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${isPast ? "bg-muted-foreground/40" : "bg-primary/50"}`}
                style={{ width: `${countdownPct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Quick stats ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Countdown / progress */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">
              {isOngoing ? t.inProgress : daysUntilTrip > 0 ? t.daysUntilLabel : t.daysAgoLabel}
            </p>
            {isOngoing ? (
              <p className="text-3xl font-bold leading-none">
                {daysElapsed}
                <span className="text-sm font-normal text-muted-foreground ml-1.5">/ {totalDays}</span>
              </p>
            ) : (
              <p className="text-3xl font-bold leading-none">
                {Math.abs(daysUntilTrip)}
                <span className="text-sm font-normal text-muted-foreground ml-1.5">{t.days}</span>
              </p>
            )}
          </CardContent>
        </Card>

        {/* Budget */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">
              {trip.budget ? t.statsSpent : t.statsExpenses}
            </p>
            <p className="text-3xl font-bold leading-none">
              {formatCurrency(totalExpenses, trip.currency, t.dateLocale, { maximumFractionDigits: 0 })}
            </p>
            {trip.budget && (
              <>
                <p className="text-xs text-muted-foreground mt-1">
                  {t.ofLabel} {formatCurrency(trip.budget, trip.currency, t.dateLocale, { maximumFractionDigits: 0 })}
                </p>
                <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      budgetPct! > 90 ? "bg-destructive" :
                      budgetPct! > 70 ? "bg-yellow-500" :
                      "bg-green-500"
                    }`}
                    style={{ width: `${budgetPct}%` }}
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Flights */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">{t.statsFlights}</p>
            <p className="text-3xl font-bold leading-none">
              {trip.flights.length}
              {trip.flights.length === 0 && (
                <span className="text-xs font-normal text-muted-foreground ml-1.5">
                  {t.noneAddedLabel}
                </span>
              )}
            </p>
          </CardContent>
        </Card>

        {/* Activities */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">{t.statsActivities}</p>
            <p className="text-3xl font-bold leading-none">{trip.activities.length}</p>
            <div className="mt-1 flex gap-1.5 flex-wrap">
              {pendingActs > 0 && (
                <Badge variant="warning" className="text-xs px-1 h-4">
                  {pendingActs} {t.statusPending.toLowerCase()}
                </Badge>
              )}
              {confirmedActs > 0 && pendingActs === 0 && (
                <Badge variant="success" className="text-xs px-1 h-4">
                  {t.allBookedLabel}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Quick status widget ──────────────────────────────────────────── */}
      {hasQuickStatus && (
        <Card>
          <CardContent className="py-3 px-4">
            <div className="flex gap-6 flex-wrap">
              {trip.budget !== null && trip.budget > 0 && budgetPct !== null && (
                <div className="flex-1 min-w-28">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                    <span>{t.budget}</span>
                    <span className="font-mono tabular-nums">{Math.round(budgetPct)}%</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        budgetPct > 90 ? "bg-destructive" :
                        budgetPct > 70 ? "bg-yellow-500" :
                        "bg-green-500"
                      }`}
                      style={{ width: `${budgetPct}%` }}
                    />
                  </div>
                </div>
              )}
              {totalPackItems > 0 && (
                <div className="flex-1 min-w-28">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                    <span>{t.packing}</span>
                    <span className="font-mono tabular-nums">{packedItems}/{totalPackItems}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${(packedItems / totalPackItems) * 100}%` }}
                    />
                  </div>
                </div>
              )}
              {trip.activities.length > 0 && (
                <div className="flex-1 min-w-28">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                    <span>{t.confirmedActivities}</span>
                    <span className="font-mono tabular-nums">{confirmedActs}/{trip.activities.length}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${(confirmedActs / trip.activities.length) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Section navigation ───────────────────────────────────────────── */}
      <TripNav tripId={trip.id} counts={navCounts} />

      {/* ── Timeline ────────────────────────────────────────────────────── */}
      <div>
        <h2 className="font-semibold mb-4">{t.tripTimeline}</h2>

        <div>
          {days.map((day, index) => {
            const isToday  = isSameDay(day.date, today);
            const isDayPast = day.date < today && !isToday;
            const isLast   = index === days.length - 1;
            const isEmpty  = day.events.length === 0 && !isToday;

            if (isEmpty) {
              return (
                <div key={day.dayNumber} className="flex gap-3 items-start">
                  <div className="flex flex-col items-center w-6 shrink-0">
                    <div className="mt-1.5 w-2 h-2 rounded-full bg-muted-foreground/30 shrink-0" />
                    {!isLast && <div className="w-px flex-1 bg-border/50 mt-1 min-h-[12px]" />}
                  </div>
                  <div className="pb-2 flex-1 flex items-center gap-2">
                    <span className="text-xs text-muted-foreground/70 capitalize">
                      {t.dayN(day.dayNumber)} · {format(day.date, "EEE d MMM", { locale: dfLocale })}
                    </span>
                    {day.city && (
                      <span className="text-xs text-muted-foreground/50">
                        <MapPin className="h-2.5 w-2.5 inline mr-0.5" />{day.city}
                      </span>
                    )}
                  </div>
                </div>
              );
            }

            return (
              <div key={day.dayNumber} className="flex gap-3">
                <div className="flex flex-col items-center w-6 shrink-0">
                  <div className={`mt-1.5 w-2.5 h-2.5 rounded-full border-2 shrink-0 ${
                    isToday    ? "bg-primary border-primary ring-2 ring-primary/20" :
                    isDayPast  ? "bg-muted-foreground/40 border-muted-foreground/40" :
                                 "bg-background border-border"
                  }`} />
                  {!isLast && <div className="w-px flex-1 bg-border mt-1" />}
                </div>

                <div className="pb-5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className={`text-sm font-semibold ${isDayPast ? "text-muted-foreground" : ""}`}>
                      {t.dayN(day.dayNumber)}
                    </span>
                    <span className="text-xs text-muted-foreground capitalize">
                      {format(day.date, "EEEE d MMM", { locale: dfLocale })}
                    </span>
                    {isToday && (
                      <Badge className="text-xs px-1.5 h-4 shrink-0">{t.today}</Badge>
                    )}
                    {day.city && (
                      <Badge variant="outline" className="text-xs px-1.5 h-4 shrink-0">
                        <MapPin className="h-2.5 w-2.5 mr-0.5" />
                        {day.city}
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-1">
                    {day.events.map((event, ei) => (
                      <EventRow key={ei} event={event} tripId={trip.id} t={t} />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Undated activities */}
        {undatedActivities.length > 0 && (
          <div className="mt-2 p-3 border border-dashed rounded-lg">
            <p className="text-xs font-medium text-muted-foreground mb-2">{t.undatedActivities}</p>
            <div className="space-y-1">
              {undatedActivities.map((act) => (
                <EventRow key={act.id} event={{ type: "activity", data: act }} tripId={trip.id} t={t} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

import type { WebTKeys } from "@/i18n";

const ACTIVITY_ICONS: Record<string, React.ElementType> = {
  RESTAURANT: Utensils,
  MUSEUM:     Landmark,
  TRANSPORT:  Navigation,
  SHOW:       Ticket,
  TOUR:       Package,
  ACTIVITY:   Star,
  OTHER:      Star,
};

function EventRow({ event, tripId, t }: { event: DayEvent; tripId: string; t: WebTKeys }) {
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
          {role === "departure" ? t.flightDeparture : t.flightArrival}
        </span>
        <span className="text-muted-foreground truncate">
          {f.airline} {f.flightNumber} · {f.origin} → {f.destination}
        </span>
        <span className="text-muted-foreground shrink-0 ml-auto font-mono">
          {time ? format(time, "HH:mm") : "—"}
        </span>
        <ConfirmBadge confirmed={!!f.bookingRef} t={t} />
      </Link>
    );
  }

  if (event.type === "accommodation") {
    const { data: a, role } = event;
    return (
      <Link href={href} className="flex items-center gap-2 text-xs py-1 px-2 rounded bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900 hover:brightness-95 transition-[filter]">
        <Hotel className="h-3 w-3 text-emerald-600 shrink-0" />
        <span className="font-medium text-emerald-700 dark:text-emerald-400 shrink-0">
          {role === "checkin" ? t.checkIn : t.checkOut}
        </span>
        <span className="text-muted-foreground truncate">{a.name}</span>
        {a.city && <span className="text-muted-foreground shrink-0 hidden sm:block">· {a.city}</span>}
        <ConfirmBadge confirmed={!!a.bookingRef} t={t} className="ml-auto" />
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
      <ActivityStatusBadge status={act.status} t={t} className="ml-auto shrink-0" />
    </Link>
  );
}

function ConfirmBadge({ confirmed, t, className = "" }: { confirmed: boolean; t: WebTKeys; className?: string }) {
  if (confirmed) {
    return (
      <Badge variant="success" className={`text-xs h-4 px-1 shrink-0 ${className}`}>
        <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
        {t.confirmed}
      </Badge>
    );
  }
  return (
    <Badge variant="warning" className={`text-xs h-4 px-1 shrink-0 ${className}`}>
      <Circle className="h-2.5 w-2.5 mr-0.5" />
      {t.unconfirmed}
    </Badge>
  );
}

function ActivityStatusBadge({ status, t, className = "" }: { status: string; t: WebTKeys; className?: string }) {
  const configs: Record<string, { label: string; icon: React.ElementType; variant: "success" | "warning" | "outline" }> = {
    CONFIRMED: { label: t.statusConfirmed, icon: CheckCircle2, variant: "success" },
    RESERVED:  { label: t.statusReserved,  icon: CheckCircle2, variant: "success" },
    PENDING:   { label: t.statusPending,   icon: Circle,       variant: "warning" },
    CANCELLED: { label: t.statusCancelled, icon: AlertCircle,  variant: "outline" },
  };
  const cfg = configs[status];
  if (!cfg) return null;
  const Icon = cfg.icon;
  return (
    <Badge variant={cfg.variant} className={`text-xs h-4 px-1 ${cfg.variant === "outline" ? "text-muted-foreground" : ""} ${className}`}>
      <Icon className="h-2.5 w-2.5 mr-0.5" />
      {cfg.label}
    </Badge>
  );
}
