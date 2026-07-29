"use client";

import { useState, useTransition, useEffect } from "react";
import { format } from "date-fns";
import { es as esLocale, enUS } from "date-fns/locale";
import { toast } from "sonner";
import { MapPin, Waves, Award, AlertTriangle, Loader2 } from "lucide-react";
import { DivingLogImportPayload } from "@/lib/schemas";
import {
  bulkImportDivingLog,
  checkDivingLogDuplicates,
  DivingLogDuplicateFlags,
} from "@/actions/dive-import";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useT } from "@/contexts/LanguageContext";
import type { WebTKeys } from "@/i18n";

type SectionKey = "sites" | "logs" | "certifications";

function sectionConfig(t: WebTKeys): Record<SectionKey, { label: string; icon: React.ElementType }> {
  return {
    sites: { label: t.diveImportSectionSites, icon: MapPin },
    logs: { label: t.diveImportSectionLogs, icon: Waves },
    certifications: { label: t.diveImportSectionCertifications, icon: Award },
  };
}

type SelectionState = Record<SectionKey, boolean[]>;

function initSelection(payload: DivingLogImportPayload): SelectionState {
  return {
    sites: payload.sites.map(() => true),
    logs: payload.logs.map(() => true),
    certifications: payload.certifications.map(() => true),
  };
}

function applyDuplicateFlags(prev: SelectionState, flags: DivingLogDuplicateFlags): SelectionState {
  return {
    sites: prev.sites.map((v, i) => (flags.sites[i] ? false : v)),
    logs: prev.logs.map((v, i) => (flags.logs[i] ? false : v)),
    certifications: prev.certifications.map((v, i) => (flags.certifications[i] ? false : v)),
  };
}

export function DiveImportReviewStep({
  payload,
  onBack,
  onDone,
}: {
  payload: DivingLogImportPayload;
  onBack: () => void;
  onDone: () => void;
}) {
  const { t } = useT();
  const SECTION_CONFIG = sectionConfig(t);
  const [selection, setSelection] = useState<SelectionState>(() => initSelection(payload));
  const [dupFlags, setDupFlags] = useState<DivingLogDuplicateFlags | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    checkDivingLogDuplicates(payload)
      .then((flags) => {
        setDupFlags(flags);
        setSelection((prev) => applyDuplicateFlags(prev, flags));
      })
      .catch(() => {
        // Non-fatal: if the check fails, we just skip duplicate marking.
      })
      .finally(() => setIsChecking(false));
    // payload doesn't change during the lifecycle of this step
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeSections = (Object.keys(SECTION_CONFIG) as SectionKey[]).filter(
    (k) => payload[k].length > 0,
  );
  const [activeTab, setActiveTab] = useState<string>(activeSections[0] ?? "logs");

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
    const filtered: DivingLogImportPayload = {
      sites: payload.sites.filter((_, i) => selection.sites[i]),
      logs: payload.logs.filter((_, i) => selection.logs[i]),
      certifications: payload.certifications.filter((_, i) => selection.certifications[i]),
    };

    startTransition(async () => {
      try {
        const result = await bulkImportDivingLog(filtered);
        const parts = [
          result.sites > 0 && t.diveImportResultSites(result.sites),
          result.logs > 0 && t.diveImportResultLogs(result.logs),
          result.certifications > 0 && t.diveImportResultCertifications(result.certifications),
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
        <p className="text-sm text-muted-foreground">{t.reviewIntro}</p>
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
          const items = payload[key] as unknown[];
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

const gasMixLabelKey: Record<string, keyof WebTKeys> = {
  AIR: "gasMixAir",
  NITROX: "gasMixNitrox",
  TRIMIX: "gasMixTrimix",
  OXYGEN: "gasMixOxygen",
};

function ItemSummary({ section, item, t }: { section: SectionKey; item: unknown; t: WebTKeys }) {
  switch (section) {
    case "sites": {
      const s = item as DivingLogImportPayload["sites"][number];
      return (
        <div className="text-xs space-y-0.5">
          <p className="font-medium">{s.name}</p>
          {s.country && <p className="text-muted-foreground">{s.country}</p>}
        </div>
      );
    }
    case "logs": {
      const l = item as DivingLogImportPayload["logs"][number];
      const gasLabel = t[gasMixLabelKey[l.gasMix]] as string;
      return (
        <div className="text-xs space-y-0.5">
          <p className="font-medium">{safeDate(l.date, "d MMM yyyy · HH:mm", t)}</p>
          <p className="text-muted-foreground">
            {l.depthMax} m · {l.bottomTime} min · {gasLabel}
          </p>
        </div>
      );
    }
    case "certifications": {
      const c = item as DivingLogImportPayload["certifications"][number];
      return (
        <div className="text-xs space-y-0.5">
          <p className="font-medium">{c.level}</p>
          <p className="text-muted-foreground">
            {c.agency}
            {c.issueDate ? ` · ${safeDate(c.issueDate, "d MMM yyyy", t)}` : ""}
          </p>
        </div>
      );
    }
  }
}
