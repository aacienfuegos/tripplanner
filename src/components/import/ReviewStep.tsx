"use client";

import { useState, useTransition, useEffect } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { Plane, Hotel, Star, DollarSign, ShoppingBag, FileText, AlertTriangle, Loader2 } from "lucide-react";
import { ImportPayload } from "@/lib/import-schemas";
import { bulkImport, checkDuplicates, DuplicateFlags } from "@/actions/import";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

type SectionKey = "flights" | "accommodations" | "activities" | "expenses" | "packing" | "documents";

const SECTION_CONFIG: Record<SectionKey, { label: string; icon: React.ElementType }> = {
  flights:        { label: "Vuelos",        icon: Plane },
  accommodations: { label: "Alojamientos",  icon: Hotel },
  activities:     { label: "Actividades",   icon: Star },
  expenses:       { label: "Gastos",        icon: DollarSign },
  packing:        { label: "Equipaje",      icon: ShoppingBag },
  documents:      { label: "Documentos",    icon: FileText },
};

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
  const [selection, setSelection] = useState<SelectionState>(() => initSelection(payload));
  const [dupFlags, setDupFlags] = useState<DuplicateFlags | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    checkDuplicates(tripId, payload).then((flags) => {
      setDupFlags(flags);
      setSelection((prev) => applyDuplicateFlags(prev, flags));
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
          result.flights        > 0 && `${result.flights} vuelo${result.flights > 1 ? "s" : ""}`,
          result.accommodations > 0 && `${result.accommodations} alojamiento${result.accommodations > 1 ? "s" : ""}`,
          result.activities     > 0 && `${result.activities} actividad${result.activities > 1 ? "es" : ""}`,
          result.expenses       > 0 && `${result.expenses} gasto${result.expenses > 1 ? "s" : ""}`,
          result.packing        > 0 && `${result.packing} ítem${result.packing > 1 ? "s de equipaje" : " de equipaje"}`,
          result.documents      > 0 && `${result.documents} documento${result.documents > 1 ? "s" : ""}`,
        ].filter(Boolean);
        toast.success(`Importados: ${parts.join(", ")}`);
        onDone();
      } catch {
        toast.error("Error al importar. Inténtalo de nuevo.");
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Revisa los ítems detectados. Desmarca los que no quieras importar.
        </p>
        {isChecking && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
            <Loader2 className="h-3 w-3 animate-spin" />
            Verificando duplicados…
          </span>
        )}
        {!isChecking && totalDuplicates > 0 && (
          <Badge variant="outline" className="text-xs border-yellow-400 text-yellow-600 shrink-0">
            <AlertTriangle className="h-3 w-3 mr-1" />
            {totalDuplicates} posible{totalDuplicates > 1 ? "s duplicados" : " duplicado"}
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
                  {selection[key].filter(Boolean).length} de {items.length} seleccionados
                </span>
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => toggleAll(key, !allSelected)}
                >
                  {allSelected ? "Deseleccionar todo" : "Seleccionar todo"}
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
                    <ItemSummary section={key} item={item} />
                  </div>
                  {sectionDups[idx] && (
                    <Badge
                      variant="outline"
                      className="text-xs border-yellow-400 text-yellow-600 px-1 h-4 shrink-0 self-start mt-0.5"
                    >
                      <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                      Duplicado
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
          ← Volver
        </Button>
        <Button
          size="sm"
          onClick={handleImport}
          disabled={totalSelected === 0 || isPending || isChecking}
        >
          {isPending
            ? "Importando..."
            : `Importar ${totalSelected} ítem${totalSelected !== 1 ? "s" : ""}`}
        </Button>
      </div>
    </div>
  );
}

function safeDate(value: string | null | undefined, fmt: string): string {
  if (!value) return "—";
  try {
    return format(new Date(value), fmt, { locale: es });
  } catch {
    return value;
  }
}

function ItemSummary({ section, item }: { section: SectionKey; item: any }) {
  switch (section) {
    case "flights":
      return (
        <div className="text-xs space-y-0.5">
          <p className="font-medium">{item.airline} {item.flightNumber}</p>
          <p className="text-muted-foreground">{item.origin} → {item.destination}</p>
          <p className="text-muted-foreground">{safeDate(item.departureAt, "d MMM yyyy · HH:mm")}</p>
        </div>
      );
    case "accommodations":
      return (
        <div className="text-xs space-y-0.5">
          <p className="font-medium">{item.name}</p>
          <p className="text-muted-foreground">{item.city} · {item.type}</p>
          <p className="text-muted-foreground">
            {safeDate(item.checkIn, "d MMM")} — {safeDate(item.checkOut, "d MMM yyyy")}
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
            <p className="text-muted-foreground">{safeDate(item.scheduledAt, "d MMM yyyy · HH:mm")}</p>
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
          <p className="text-muted-foreground">{safeDate(item.date, "d MMM yyyy")}</p>
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
              Vence: {safeDate(item.expiresAt, "d MMM yyyy")}
            </p>
          )}
        </div>
      );
  }
}
