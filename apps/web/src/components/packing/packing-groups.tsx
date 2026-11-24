"use client";

import { Pencil, PackageX, Share2, Trash2 } from "lucide-react";
import { formatWeight, type UnitSystem } from "@tripplanner/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PackingItem, Suitcase } from "@/types";
import { useT } from "@/contexts/LanguageContext";
import { suitcaseTypeLabel } from "./suitcase-form-dialog";
import { AgentBadge } from "@/components/agents/agent-badge";

export type PackingView = "category" | "suitcase";

export interface PackingGroupHandlers {
  onToggle: (item: PackingItem) => void;
  onSelect: (id: string) => void;
  onEdit: (item: PackingItem) => void;
  onDelete: (item: PackingItem) => void;
  onEditSuitcase: (suitcase: Suitcase) => void;
  onDeleteSuitcase: (suitcase: Suitcase) => void;
  onUnpackSuitcase: (suitcase: Suitcase) => void;
  onShareSuitcase: (suitcase: Suitcase) => void;
}

interface Props extends PackingGroupHandlers {
  view: PackingView;
  // `visible` is what the search and the pending filter leave; progress is always
  // counted over `items`, so filtering doesn't move the bars.
  items: readonly PackingItem[];
  visible: readonly PackingItem[];
  suitcases: readonly Suitcase[];
  unitSystem: UnitSystem;
  hasQuery: boolean;
  selecting: boolean;
  selected: ReadonlySet<string>;
}

const progress = (items: readonly PackingItem[]) => ({
  packed: items.filter((i) => i.packed).length,
  total: items.length,
});

export function PackingGroups(props: Props) {
  return props.view === "category" ? <ByCategory {...props} /> : <BySuitcase {...props} />;
}

function ByCategory({ items, visible, suitcases, ...rest }: Props) {
  const categories = [...new Set(visible.map((i) => i.category))];
  const suitcaseNames = new Map(suitcases.map((s) => [s.id, s.name]));
  return (
    <div className="space-y-4">
      {categories.map((category) => {
        const { packed, total } = progress(items.filter((i) => i.category === category));
        return (
          <Card key={category}>
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                {category} ({packed}/{total})
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-1">
              {visible.filter((i) => i.category === category).map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  suitcaseName={item.suitcaseId ? suitcaseNames.get(item.suitcaseId) : undefined}
                  {...rest}
                />
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function BySuitcase({ items, visible, suitcases, unitSystem, hasQuery, ...rest }: Props) {
  const { t } = useT();
  const loose = visible.filter((i) => i.suitcaseId === null);
  return (
    <div className="space-y-4">
      {suitcases.map((suitcase) => {
        const all = items.filter((i) => i.suitcaseId === suitcase.id);
        const shown = visible.filter((i) => i.suitcaseId === suitcase.id);
        if (hasQuery && shown.length === 0) return null;
        const { packed, total } = progress(all);
        return (
          <Card key={suitcase.id}>
            <CardHeader className="pb-2 pt-4 space-y-2">
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0 flex flex-wrap items-center gap-2">
                  <CardTitle className="text-base">{suitcase.name}</CardTitle>
                  <Badge variant="secondary">{suitcaseTypeLabel(t, suitcase.type)}</Badge>
                  {suitcase.weightGrams !== null && (
                    <span className="text-sm text-muted-foreground">
                      {formatWeight(suitcase.weightGrams, unitSystem, t.locale)}
                    </span>
                  )}
                  <span className="text-sm text-muted-foreground">{packed}/{total}</span>
                </div>
                {!rest.selecting && <SuitcaseActions suitcase={suitcase} total={total} packed={packed} {...rest} />}
              </div>
              {total > 0 && (
                <div className="w-full bg-muted rounded-full h-1.5">
                  <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${(packed / total) * 100}%` }} />
                </div>
              )}
            </CardHeader>
            <CardContent className="pt-0 space-y-1">
              {total === 0 && <p className="text-sm text-muted-foreground py-1">{t.suitcaseEmpty}</p>}
              {shown.map((item) => <ItemRow key={item.id} item={item} {...rest} />)}
            </CardContent>
          </Card>
        );
      })}
      {loose.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              {t.noSuitcase}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-1">
            {loose.map((item) => <ItemRow key={item.id} item={item} {...rest} />)}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SuitcaseActions({ suitcase, total, packed, onEditSuitcase, onDeleteSuitcase, onUnpackSuitcase, onShareSuitcase }:
  PackingGroupHandlers & { suitcase: Suitcase; total: number; packed: number }) {
  const { t } = useT();
  return (
    <div className="flex items-center shrink-0">
      <Button variant="ghost" size="icon-sm" aria-label={t.packingShare} title={t.packingShare}
        disabled={total === 0} onClick={() => onShareSuitcase(suitcase)}>
        <Share2 className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label={t.packingUnpackAll} title={t.packingUnpackAll}
        disabled={packed === 0} onClick={() => onUnpackSuitcase(suitcase)}>
        <PackageX className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label={t.editSuitcase} title={t.editSuitcase}
        onClick={() => onEditSuitcase(suitcase)}>
        <Pencil className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label={t.delete} title={t.delete}
        onClick={() => onDeleteSuitcase(suitcase)}>
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}

function ItemRow({ item, suitcaseName, selecting, selected, onToggle, onSelect, onEdit, onDelete }:
  Pick<Props, "selecting" | "selected"> & PackingGroupHandlers & { item: PackingItem; suitcaseName?: string }) {
  const { t } = useT();
  const isSelected = selected.has(item.id);
  // Fine pointers show the row buttons on hover; touch screens always show them (#341).
  const rowButton = "-m-2 p-2 pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity text-muted-foreground";
  return (
    <div className="flex items-center gap-3 group">
      <label className="flex flex-1 min-w-0 items-center gap-3 py-2 sm:py-1.5 cursor-pointer">
        <input
          type="checkbox"
          checked={selecting ? isSelected : item.packed}
          onChange={() => (selecting ? onSelect(item.id) : onToggle(item))}
          className="h-4 w-4 shrink-0 cursor-pointer"
        />
        <span className={`flex-1 min-w-0 text-sm ${item.packed ? "line-through text-muted-foreground" : ""}`}>
          {item.name}
          {item.quantity > 1 && <span className="text-muted-foreground ml-1">×{item.quantity}</span>}
        </span>
        <AgentBadge id={item.id} />
        {suitcaseName && <span className="shrink-0 text-xs text-muted-foreground">{suitcaseName}</span>}
      </label>
      {!selecting && (
        <>
          <button onClick={() => onEdit(item)} aria-label={t.editPackingItem} className={`${rowButton} hover:text-foreground`}>
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => onDelete(item)} aria-label={t.delete} className={`${rowButton} hover:text-destructive`}>
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </>
      )}
    </div>
  );
}
