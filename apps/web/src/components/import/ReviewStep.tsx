"use client";

import { useState, useTransition, useEffect } from "react";
import { format } from "date-fns";
import { es as esLocale, enUS } from "date-fns/locale";
import { toast } from "sonner";
import { Plane, Hotel, Star, DollarSign, ShoppingBag, FileText, AlertTriangle, Loader2 } from "lucide-react";
import { ImportPayload } from "@tripplanner/shared";
import { bulkImport, checkDuplicates, DuplicateFlags } from "@/actions/import";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useT } from "@/contexts/LanguageContext";
import type { WebTKeys } from "@/i18n";

type SectionKey = "flights" | "accommodations" | "activities" | "expenses" | "packing" | "documents";

function sectionConfig(t: WebTKeys): Record<SectionKey, { label: string; icon: React.ElementType }> {
  return {
    flights:        { label: t.sectionFlights,        icon: Plane },
    accommodations: { label: t.sectionAccommodations, icon: Hotel },
    activities:     { label: t.sectionActivities,     icon: Star },
    expenses:       { label: t.sectionExpenses,        icon: DollarSign },
    packing:        { label: t.sectionPacking,        icon: ShoppingBag },
    documents:      { label: t.sectionDocuments,      icon: FileText },
  };
}

type SelectionState = Record<SectionKey, boolean[]>;

function initSelection(payload: ImportPayload): SelectionState {
  return {
    flights:        payload.flights.map(() => true),
    accommodations: payload.accommodations.map(() => true),
    activities:     payload.activities.map(() => true),
    expenses:       payload.expenses.map(() => true),
    packing:        payload.packing.map(() => true),
    documents:      payload.documents.map(() => true),
  };
}

function applyDuplicateFlags(prev: SelectionState, flags: DuplicateFlags): SelectionState {
  return {
    flights:        prev.flights.map((v, i) => flags.flights[i] ? false : v),
    accommodations: prev.accommodations.map((v, i) => flags.accommodations[i] ? false : v),
    activities:     prev.activities.map((v, i) => flags.activities[i] ? false : v),
    expenses:       prev.expenses.map((v, i) => flags.expenses[i] ? false : v),
    packing:        prev.packing.map((v, i) => flags.packing[i] ? false : v),
    documents:      prev.documents.map((v, i) => flags.documents[i] ? false : v),
  };
}

export function ReviewStep({
  tripId,
  payload,
  onBack,
  onDone,
}: {
  tripId: string;
  payload: ImportPayload;
  onBack: () => void;
  onDone: () => void;
}) {
  const { t } = useT();
  const SECTION_CONFIG = sectionConfig(t);
  const [selection, setSelection] = useState<SelectionState>(() => initSelection(payload));
  const [dupFlags, setDupFlags] = useState<DuplicateFlags | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    checkDuplicates(tripId, payload)
      .then((flags) => {
        setDupFlags(flags);
        setSelection((prev) => applyDuplicateFlags(prev, flags));
      })
      .catch(() => {
        // Non-fatal: if the check fails, we just skip duplicate marking
      })
      .finally(() => {
        setIsChecking(false);
      });
    // tripId and payload don't change during the lifecycle of this step
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeSections = (Object.keys(SECTION_CONFIG) as SectionKey[]).filter(
    (k) => payload[k].length > 0,
  );
  const [activeTab, setActiveTab] = useState<string>(activeSections[0] ?? "flights");

  const totalDuplicates = dupFlags
    ? (Object.keys(dupFlags) as SectionKey[]).reduce(
        (sum, k) => sum + dupFlags[k].filter(Boolean).length,
        0,
      )
    : 0;

  const toggleItem = (section: SectionKey, idx: number) => {
    setSelection((prev) => ({
      ...prev,
      [section]: prev[section].map((v, i) => (i === idx ? !v : v)),
    }));
  };

  const toggleAll = (section: SectionKey, value: boolean) => {
    setSelection((prev) => ({
      ...prev,
      [section]: prev[section].map(() => value),
    }));
  };

  const totalSelected = activeSections.reduce(
    (sum, k) => sum + selection[k].filter(Boolean).length,
    0,
  );

  const handleImport = () => {
    const filtered: ImportPayload = {
      flights:        payload.flights.filter((_, i) => selection.flights[i]),
      accommodations: payload.accommodations.filter((_, i) => selection.accommodations[i]),
      activities:     payload.activities.filter((_, i) => selection.activities[i]),
      expenses:       payload.expenses.filter((_, i) => selection.expenses[i]),
      packing:        payload.packing.filter((_, i) => selection.packing[i]),
      documents:      payload.documents.filter((_, i) => selection.documents[i]),
    };

    startTransition(async () => {
      try {
        const result = await bulkImport(tripId, filtered);
        const parts = [
          result.flights        > 0 && t.unitFlight(result.flights),
          result.accommodations > 0 && t.unitAccommodation(result.accommodations),
          result.activities     > 0 && t.unitActivity(result.activities),
          result.expenses       > 0 && t.unitExpense(result.expenses),
          result.packing        > 0 && t.unitPacking(result.packing),
          result.documents      > 0 && t.unitDocument(result.documents),
        ].filter(Boolean);
        toast.success(`${t.importedToastPrefix}: ${parts.join(", ")}`);
        onDone();
      } catch {
        toast.error(t.importErrorToast);
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          {t.reviewIntro}
        </p>
        {isChecking && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
            <Loader2 className="h-3 w-3 animate-spin" />
            {t.checkingDuplicates}
          </span>
        )}
        {!isChecking && totalDuplicates > 0 && (
          <Badge variant="warning" className="text-xs shrink-0">
            <AlertTriangle className="h-3 w-3 mr-1" />
            {t.possibleDuplicates(totalDuplicates)}
          </Badge>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="h-auto flex flex-wrap gap-1 bg-transparent p-0 justify-start">
          {activeSections.map((key) => {
            const { label, icon: Icon } = SECTION_CONFIG[key];
            const selected = selection[key].filter(Boolean).length;
            const total = payload[key].length;
            return (
              <TabsTrigger key={key} value={key} className="text-xs h-7 gap-1">
                <Icon className="h-3 w-3" />
                {label}
                <Badge variant="secondary" className="ml-0.5 text-xs h-4 px-1">
                  {selected}/{total}
                </Badge>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {activeSections.map((key) => {
          const allSelected = selection[key].every(Boolean);
          const items = payload[key] as any[];
          const sectionDups = dupFlags?.[key] ?? items.map(() => false);

          return (
            <TabsContent key={key} value={key} className="mt-3 space-y-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">
                  {t.selectedOfTotal(selection[key].filter(Boolean).length, items.length)}
                </span>
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => toggleAll(key, !allSelected)}
                >
                  {allSelected ? t.deselectAll : t.selectAll}
                </button>
              </div>

              {items.map((item, idx) => (
                <label
                  key={idx}
                  className="flex items-start gap-2.5 p-2 rounded-md border cursor-pointer hover:bg-muted/50 transition-colors has-[input:checked]:border-primary/40 has-[input:checked]:bg-primary/5"
                >
                  <input
                    type="checkbox"
                    checked={selection[key][idx]}
                    onChange={() => toggleItem(key, idx)}
                    className="mt-0.5 accent-primary"
                  />
                  <div className="flex-1 min-w-0">
                    <ItemSummary section={key} item={item} t={t} />
                  </div>
                  {sectionDups[idx] && (
                    <Badge
                      variant="warning"
                      className="text-xs px-1 h-4 shrink-0 self-start mt-0.5"
                    >
                      <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                      {t.duplicate}
                    </Badge>
                  )}
                </label>
              ))}
            </TabsContent>
          );
        })}
      </Tabs>

      <div className="flex justify-between items-center pt-2 border-t">
        <Button variant="ghost" size="sm" onClick={onBack} disabled={isPending}>
          {t.backArrow}
        </Button>
        <Button
          size="sm"
          onClick={handleImport}
          disabled={totalSelected === 0 || isPending || isChecking}
        >
          {isPending ? t.importingEllipsis : t.importNItems(totalSelected)}
        </Button>
      </div>
    </div>
  );
}

function safeDate(value: string | null | undefined, fmt: string, t: WebTKeys): string {
  if (!value) return "—";
  try {
    return format(new Date(value), fmt, { locale: t.locale === "es" ? esLocale : enUS });
  } catch {
    return value;
  }
}

function ItemSummary({ section, item, t }: { section: SectionKey; item: any; t: WebTKeys }) {
  switch (section) {
    case "flights":
      return (
        <div className="text-xs space-y-0.5">
          <p className="font-medium">{item.airline} {item.flightNumber}</p>
          <p className="text-muted-foreground">{item.origin} → {item.destination}</p>
          <p className="text-muted-foreground">{safeDate(item.departureAt, "d MMM yyyy · HH:mm", t)}</p>
        </div>
      );
    case "accommodations":
      return (
        <div className="text-xs space-y-0.5">
          <p className="font-medium">{item.name}</p>
          <p className="text-muted-foreground">{item.city} · {item.type}</p>
          <p className="text-muted-foreground">
            {safeDate(item.checkIn, "d MMM", t)} — {safeDate(item.checkOut, "d MMM yyyy", t)}
          </p>
        </div>
      );
    case "activities":
      return (
        <div className="text-xs space-y-0.5">
          <p className="font-medium">{item.name}</p>
          <p className="text-muted-foreground">
            {item.type}{item.city ? ` · ${item.city}` : ""}
          </p>
          {item.scheduledAt && (
            <p className="text-muted-foreground">{safeDate(item.scheduledAt, "d MMM yyyy · HH:mm", t)}</p>
          )}
        </div>
      );
    case "expenses":
      return (
        <div className="text-xs space-y-0.5">
          <p className="font-medium">{item.description}</p>
          <p className="text-muted-foreground">
            {item.amount} {item.currency} · {item.category}
          </p>
          <p className="text-muted-foreground">{safeDate(item.date, "d MMM yyyy", t)}</p>
        </div>
      );
    case "packing":
      return (
        <div className="text-xs space-y-0.5">
          <p className="font-medium">{item.name}</p>
          <p className="text-muted-foreground">
            {item.category}{item.quantity > 1 ? ` · ×${item.quantity}` : ""}
          </p>
        </div>
      );
    case "documents":
      return (
        <div className="text-xs space-y-0.5">
          <p className="font-medium">{item.name}</p>
          <p className="text-muted-foreground">{item.type}</p>
          {item.expiresAt && (
            <p className="text-muted-foreground">
              {t.expiresAt}: {safeDate(item.expiresAt, "d MMM yyyy", t)}
            </p>
          )}
        </div>
      );
  }
}
