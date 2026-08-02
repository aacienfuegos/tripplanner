import { useState, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { Tabs, useFocusEffect, useGlobalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { getTrip, getTripSummary, getTimelineData, TimelineFlight, TimelineAccommodation, TimelineActivity } from "@/db/trips";
import { useT } from "@/contexts/I18nContext";
import { useColorScheme } from "nativewind";
import { useTripLock } from "@/contexts/TripLockContext";

// ─── Types ────────────────────────────────────────────────────────────────────

type DayEvent =
  | { kind: "flight-dep"; data: TimelineFlight }
  | { kind: "flight-arr"; data: TimelineFlight }
  | { kind: "checkin";    data: TimelineAccommodation }
  | { kind: "checkout";   data: TimelineAccommodation }
  | { kind: "activity";   data: TimelineActivity };

interface TimelineDay {
  date: string;
  dayNum: number;
  isToday: boolean;
  isPast: boolean;
  events: DayEvent[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dateDiff(a: string, b: string): number {
  return Math.round((new Date(b + "T12:00:00").getTime() - new Date(a + "T12:00:00").getTime()) / 86400000);
}

function addDaysToDate(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function eventTime(e: DayEvent): string {
  if (e.kind === "flight-dep") return e.data.departure_at ?? "99:99";
  if (e.kind === "flight-arr") return e.data.arrival_at  ?? "99:99";
  if (e.kind === "checkin")    return e.data.check_in    ?? "00:00";
  if (e.kind === "checkout")   return e.data.check_out   ?? "23:59";
  return e.data.scheduled_at ?? "99:99";
}

function fmtTime(iso: string | null): string {
  if (!iso) return "";
  const t = iso.slice(11, 16);
  return t !== "00:00" ? t : "";
}

function fmtDayHeader(dateStr: string, lang: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const locale = lang === "es" ? "es-ES" : "en-US";
  return d.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" });
}

function buildTimeline(
  startDate: string,
  endDate: string,
  data: ReturnType<typeof getTimelineData>
): TimelineDay[] {
  const today = new Date().toISOString().slice(0, 10);
  const totalDays = dateDiff(startDate, endDate) + 1;
  const days: TimelineDay[] = [];

  for (let i = 0; i < totalDays; i++) {
    const date = addDaysToDate(startDate, i);
    const events: DayEvent[] = [];

    for (const f of data.flights) {
      if (f.departure_at?.slice(0, 10) === date) events.push({ kind: "flight-dep", data: f });
      if (f.arrival_at?.slice(0, 10) === date)   events.push({ kind: "flight-arr", data: f });
    }
    for (const a of data.accommodations) {
      if (a.check_in?.slice(0, 10) === date)  events.push({ kind: "checkin",  data: a });
      if (a.check_out?.slice(0, 10) === date) events.push({ kind: "checkout", data: a });
    }
    for (const act of data.activities) {
      if (act.scheduled_at?.slice(0, 10) === date) events.push({ kind: "activity", data: act });
    }

    events.sort((a, b) => eventTime(a).localeCompare(eventTime(b)));

    days.push({
      date,
      dayNum: i + 1,
      isToday: date === today,
      isPast: date < today,
      events,
    });
  }
  return days;
}

// ─── Status colors ────────────────────────────────────────────────────────────

const ACTIVITY_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  CONFIRMED: { bg: "#dcfce7", text: "#166534" },
  RESERVED:  { bg: "#fef9c3", text: "#854d0e" },
  PENDING:   { bg: "#f1f5f9", text: "#64748b" },
  CANCELLED: { bg: "#fee2e2", text: "#991b1b" },
};

// ─── Event row ────────────────────────────────────────────────────────────────

function EventChip({ event, t }: { event: DayEvent; t: ReturnType<typeof useT>["t"] }) {
  if (event.kind === "flight-dep" || event.kind === "flight-arr") {
    const { data: f, kind } = event;
    const isDep = kind === "flight-dep";
    const time = fmtTime(isDep ? f.departure_at : f.arrival_at);
    const route = `${f.origin} → ${f.destination}`;
    const label = [f.airline, f.flight_number].filter(Boolean).join(" ");
    return (
      <View className="flex-row items-center bg-blue-50 dark:bg-blue-950 border border-blue-100 dark:border-blue-900 rounded-xl px-3 py-2 mb-1.5 gap-2">
        <Ionicons
          name={isDep ? "airplane-outline" : "airplane-outline"}
          size={14}
          color="#2563eb"
          style={isDep ? {} : { transform: [{ scaleX: -1 }] }}
        />
        <View className="flex-1">
          <Text className="text-xs font-semibold text-blue-700 dark:text-blue-300">
            {isDep ? t.flightDeparture : t.flightArrival}
            {label ? ` · ${label}` : ""}
          </Text>
          <Text className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">{route}</Text>
        </View>
        <View className="items-end gap-0.5">
          {time ? <Text className="text-xs font-mono font-medium text-blue-600 dark:text-blue-400">{time}</Text> : null}
          {f.booking_ref ? (
            <Ionicons name="checkmark-circle" size={12} color="#16a34a" />
          ) : null}
        </View>
      </View>
    );
  }

  if (event.kind === "checkin" || event.kind === "checkout") {
    const { data: a, kind } = event;
    const isIn = kind === "checkin";
    return (
      <View className="flex-row items-center bg-teal-50 dark:bg-teal-950 border border-teal-100 dark:border-teal-900 rounded-xl px-3 py-2 mb-1.5 gap-2">
        <Ionicons name="bed-outline" size={14} color="#0d9488" />
        <View className="flex-1">
          <Text className="text-xs font-semibold text-teal-700 dark:text-teal-300">
            {isIn ? t.checkIn : t.checkOut}
          </Text>
          <Text className="text-xs text-teal-600 dark:text-teal-400 mt-0.5">
            {a.name}{a.city ? ` · ${a.city}` : ""}
          </Text>
        </View>
        {a.booking_ref ? <Ionicons name="checkmark-circle" size={12} color="#16a34a" /> : null}
      </View>
    );
  }

  // activity
  const { data: act } = event;
  const sc = ACTIVITY_STATUS_COLORS[act.status] ?? ACTIVITY_STATUS_COLORS.PENDING;
  const time = fmtTime(act.scheduled_at);
  return (
    <View className="flex-row items-center bg-orange-50 dark:bg-orange-950 border border-orange-100 dark:border-orange-900 rounded-xl px-3 py-2 mb-1.5 gap-2">
      <Ionicons name="walk-outline" size={14} color="#f97316" />
      <View className="flex-1">
        <Text className="text-xs font-semibold text-orange-700 dark:text-orange-300" numberOfLines={1}>
          {act.name}
        </Text>
        {act.city ? <Text className="text-xs text-orange-500 dark:text-orange-400 mt-0.5">{act.city}</Text> : null}
      </View>
      <View className="items-end gap-0.5">
        {time ? <Text className="text-xs font-mono font-medium text-orange-500 dark:text-orange-400">{time}</Text> : null}
        <View className="rounded-full px-1.5 py-0.5" style={{ backgroundColor: sc.bg }}>
          <Text className="text-xs font-medium" style={{ color: sc.text, fontSize: 10 }}>
            {act.status === "CONFIRMED" ? "✓" : act.status === "CANCELLED" ? "✗" : "·"}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function TripOverviewScreen() {
  const { id } = useGlobalSearchParams<{ id: string }>();
  const tripId = Number(id);
  const router = useRouter();
  const { t, lang } = useT();
  const { guard } = useTripLock();
  const { colorScheme } = useColorScheme();

  const [trip, setTrip] = useState(() => getTrip(tripId));
  const [summary, setSummary] = useState(() =>
    getTripSummary(tripId, getTrip(tripId)?.currency ?? "EUR")
  );
  const [timeline, setTimeline] = useState<TimelineDay[]>([]);

  useFocusEffect(
    useCallback(() => {
      const tr = getTrip(tripId);
      if (!tr) return;
      setTrip(tr);
      setSummary(getTripSummary(tripId, tr.currency));
      if (tr.start_date && tr.end_date) {
        const data = getTimelineData(tripId);
        setTimeline(buildTimeline(tr.start_date.slice(0, 10), tr.end_date.slice(0, 10), data));
      }
    }, [tripId])
  );

  if (!trip) return null;

  const today = new Date().toISOString().slice(0, 10);
  const startDate = trip.start_date?.slice(0, 10);
  const endDate   = trip.end_date?.slice(0, 10);

  const totalDays = startDate && endDate ? dateDiff(startDate, endDate) + 1 : null;
  const isOngoing = summary.tripStatus === "ongoing";
  const isPast    = summary.tripStatus === "past";

  let daysElapsed = 0;
  if (isOngoing && startDate) daysElapsed = dateDiff(startDate, today) + 1;
  if (isPast && totalDays) daysElapsed = totalDays;
  const countdownPct = totalDays ? Math.min(100, (daysElapsed / totalDays) * 100) : 0;

  function fmtDate(iso: string): string {
    const d = new Date(iso + "T12:00:00");
    const locale = lang === "es" ? "es-ES" : "en-US";
    return d.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
  }

  const hasTimeline = timeline.some((d) => d.events.length > 0);
  const undatedActivities = getTimelineData(tripId).activities.filter((a) => !a.scheduled_at);

  return (
    <SafeAreaView className="flex-1 bg-zinc-50 dark:bg-zinc-950" edges={["bottom"]}>
      <Tabs.Screen options={{
        title: t.overview,
        headerRight: () => (
          <TouchableOpacity onPress={() => router.push(`/trips/${id}/map`)} className="mr-3">
            <Ionicons name="map-outline" size={20} color={colorScheme === "dark" ? "#94a3b8" : "#374151"} />
          </TouchableOpacity>
        ),
      }} />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Header card ─── */}
        <View className="mx-4 mt-4 bg-white dark:bg-zinc-900 rounded-3xl overflow-hidden shadow-sm">
          <View className="px-5 pt-5 pb-4">
            <View className="flex-row items-start justify-between mb-1">
              <Text className="text-2xl font-black text-slate-900 dark:text-white flex-1 mr-3" numberOfLines={2}>
                {trip.name}
              </Text>
              <TouchableOpacity
                onPress={() => guard(() => router.push(`/trips/${id}/edit`))}
                className="bg-slate-100 dark:bg-zinc-800 rounded-xl p-2"
              >
                <Ionicons name="pencil-outline" size={16} color={colorScheme === "dark" ? "#94a3b8" : "#64748b"} />
              </TouchableOpacity>
            </View>

            {startDate && endDate && (
              <Text className="text-sm text-slate-500 dark:text-slate-400 mb-3">
                {fmtDate(startDate)} — {fmtDate(endDate)}
                {totalDays ? `  ·  ${totalDays} ${totalDays === 1 ? t.day : t.days}` : ""}
              </Text>
            )}

            {/* Status chip */}
            {summary.tripStatus === "upcoming" && summary.daysUntil !== null && (
              <View className="self-start bg-blue-50 dark:bg-blue-950 rounded-full px-3 py-1">
                <Text className="text-xs font-semibold text-blue-600 dark:text-blue-300">
                  {t.startsIn(summary.daysUntil)}
                </Text>
              </View>
            )}
            {isOngoing && (
              <View className="self-start bg-emerald-50 dark:bg-emerald-950 rounded-full px-3 py-1">
                <Text className="text-xs font-semibold text-emerald-600 dark:text-emerald-300">
                  {t.ongoing} · {totalDays ? t.dayOf(daysElapsed, totalDays) : ""}
                </Text>
              </View>
            )}
            {isPast && (
              <View className="self-start bg-slate-100 dark:bg-zinc-800 rounded-full px-3 py-1">
                <Text className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {t.tripCompleted}
                </Text>
              </View>
            )}

            {trip.description ? (
              <Text className="text-sm text-slate-400 dark:text-slate-500 mt-2">{trip.description}</Text>
            ) : null}
          </View>

          {/* Progress bar */}
          {(isOngoing || isPast) && totalDays && (
            <View className="px-5 pb-4">
              <View className="flex-row items-center justify-between mb-1.5">
                <Text className="text-xs text-slate-400 dark:text-slate-500">
                  {startDate ? fmtDate(startDate) : ""}
                </Text>
                <Text className="text-xs text-slate-400 dark:text-slate-500">
                  {endDate ? fmtDate(endDate) : ""}
                </Text>
              </View>
              <View className="h-1.5 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <View
                  className="h-full rounded-full"
                  style={{
                    width: `${countdownPct}%`,
                    backgroundColor: isPast ? "#94a3b8" : "#2563eb",
                  }}
                />
              </View>
            </View>
          )}
        </View>

        {/* ─── Stats row ─── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, gap: 8 }}
        >
          {/* Gastos */}
          <View className="bg-white dark:bg-zinc-900 rounded-2xl px-4 py-3 shadow-sm min-w-[100px]">
            <View className="w-8 h-8 rounded-xl items-center justify-center mb-1.5" style={{ backgroundColor: "#05966918" }}>
              <Ionicons name="cash-outline" size={16} color="#059669" />
            </View>
            <Text className="text-xs text-slate-400 dark:text-slate-500">
              {t.totalExpenses(trip.currency).replace(`Total `, "")}
            </Text>
            <Text className="text-base font-bold text-slate-900 dark:text-white">
              {summary.expensesTotal.toFixed(0)}
              <Text className="text-xs font-normal text-slate-400"> {trip.currency}</Text>
            </Text>
          </View>

          {/* Vuelos */}
          <View className="bg-white dark:bg-zinc-900 rounded-2xl px-4 py-3 shadow-sm min-w-[80px]">
            <View className="w-8 h-8 rounded-xl items-center justify-center mb-1.5" style={{ backgroundColor: "#2563eb18" }}>
              <Ionicons name="airplane-outline" size={16} color="#2563eb" />
            </View>
            <Text className="text-xs text-slate-400 dark:text-slate-500">{t.flights}</Text>
            <Text className="text-base font-bold text-slate-900 dark:text-white">{summary.flights}</Text>
          </View>

          {/* Alojamientos */}
          <View className="bg-white dark:bg-zinc-900 rounded-2xl px-4 py-3 shadow-sm min-w-[80px]">
            <View className="w-8 h-8 rounded-xl items-center justify-center mb-1.5" style={{ backgroundColor: "#0d948818" }}>
              <Ionicons name="bed-outline" size={16} color="#0d9488" />
            </View>
            <Text className="text-xs text-slate-400 dark:text-slate-500">{t.accommodations}</Text>
            <Text className="text-base font-bold text-slate-900 dark:text-white">{summary.accommodations}</Text>
          </View>

          {/* Actividades */}
          <View className="bg-white dark:bg-zinc-900 rounded-2xl px-4 py-3 shadow-sm min-w-[80px]">
            <View className="w-8 h-8 rounded-xl items-center justify-center mb-1.5" style={{ backgroundColor: "#f9731618" }}>
              <Ionicons name="walk-outline" size={16} color="#f97316" />
            </View>
            <Text className="text-xs text-slate-400 dark:text-slate-500">{t.activities}</Text>
            <Text className="text-base font-bold text-slate-900 dark:text-white">{summary.activities}</Text>
          </View>

          {/* Maleta */}
          {summary.packingTotal > 0 && (
            <View className="bg-white dark:bg-zinc-900 rounded-2xl px-4 py-3 shadow-sm min-w-[90px]">
              <View className="w-8 h-8 rounded-xl items-center justify-center mb-1.5" style={{ backgroundColor: "#4f46e518" }}>
                <Ionicons name="briefcase-outline" size={16} color="#4f46e5" />
              </View>
              <Text className="text-xs text-slate-400 dark:text-slate-500">{t.packing}</Text>
              <Text className="text-base font-bold text-slate-900 dark:text-white">
                {Math.round((summary.packingPacked / summary.packingTotal) * 100)}%
              </Text>
            </View>
          )}
        </ScrollView>

        {/* ─── Timeline ─── */}
        {startDate && endDate ? (
          <View className="mx-4 mt-4">
            <Text className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3 px-1">
              {t.timeline}
            </Text>

            {!hasTimeline && undatedActivities.length === 0 ? (
              <View className="bg-white dark:bg-zinc-900 rounded-2xl px-4 py-8 items-center shadow-sm">
                <Ionicons name="calendar-outline" size={32} color="#94a3b8" />
                <Text className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">{t.emptyTimeline}</Text>
                <Text className="text-xs text-slate-400 dark:text-slate-500 text-center mt-1">{t.emptyTimelineHint}</Text>
              </View>
            ) : (
              <View className="bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden shadow-sm">
                {timeline.map((day, idx) => {
                  const isLast = idx === timeline.length - 1;
                  const isEmpty = day.events.length === 0;

                  if (isEmpty) {
                    return (
                      <View key={day.date} className="flex-row items-center px-4 py-2.5">
                        <View className="items-center w-5 mr-3">
                          <View className="w-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-zinc-700" />
                          {!isLast && <View className="w-px flex-1 bg-slate-100 dark:bg-zinc-800 absolute top-3 h-8" />}
                        </View>
                        <Text className="text-xs text-slate-300 dark:text-zinc-600">
                          {t.dayN(day.dayNum)} · {fmtDayHeader(day.date, lang)}
                          {day.isToday ? ` · ${t.today}` : ""}
                        </Text>
                      </View>
                    );
                  }

                  return (
                    <View
                      key={day.date}
                      className={`px-4 pt-3 pb-2 ${idx < timeline.length - 1 ? "border-b border-slate-50 dark:border-zinc-800" : ""}`}
                    >
                      {/* Day header */}
                      <View className="flex-row items-center mb-2">
                        <View
                          className="w-3 h-3 rounded-full border-2 mr-3 flex-shrink-0"
                          style={{
                            backgroundColor: day.isToday ? "#2563eb" : day.isPast ? "#cbd5e1" : "transparent",
                            borderColor: day.isToday ? "#2563eb" : day.isPast ? "#cbd5e1" : "#e2e8f0",
                          }}
                        />
                        <Text className={`text-sm font-bold mr-2 ${day.isPast && !day.isToday ? "text-slate-400 dark:text-slate-600" : "text-slate-800 dark:text-slate-100"}`}>
                          {t.dayN(day.dayNum)}
                        </Text>
                        <Text className="text-xs text-slate-400 dark:text-slate-500 capitalize">
                          {fmtDayHeader(day.date, lang)}
                        </Text>
                        {day.isToday && (
                          <View className="ml-2 bg-blue-500 rounded-full px-1.5 py-0.5">
                            <Text className="text-xs text-white font-semibold">{t.today}</Text>
                          </View>
                        )}
                      </View>

                      {/* Events */}
                      <View className="ml-6">
                        {day.events.map((event, ei) => (
                          <EventChip key={ei} event={event} t={t} />
                        ))}
                      </View>
                    </View>
                  );
                })}

                {/* Undated activities */}
                {undatedActivities.length > 0 && (
                  <View className="px-4 pt-3 pb-3 border-t border-dashed border-slate-100 dark:border-zinc-800">
                    <Text className="text-xs font-semibold text-slate-400 dark:text-slate-500 mb-2">{t.undated}</Text>
                    {undatedActivities.map((act) => (
                      <EventChip
                        key={act.id}
                        event={{ kind: "activity", data: act }}
                        t={t}
                      />
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
