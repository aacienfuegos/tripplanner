"use client";

import { useState } from "react";
import { toast } from "sonner";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { Anchor, Copy, ListChecks, Luggage, PackageX, Plus, Search, ShoppingBag, Wand2 } from "lucide-react";
import { buildSuitcaseShareText, filterPackingItems, type UnitSystem } from "@tripplanner/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  createPackingItem,
  updatePackingItem,
  togglePackingItem,
  deletePackingItem,
  addDefaultPackingItems,
  addDiveEquipmentToPackingList,
  movePackingItems,
  deletePackingItems,
  setPackedPackingItems,
  unpackAllPackingItems,
  copyPackingFromTrip,
} from "@/actions/packing";
import { deleteSuitcase } from "@/actions/suitcases";
import type { PackingItem, Suitcase } from "@/types";
import { useT } from "@/contexts/LanguageContext";
import { PackingGroups, type PackingView } from "./packing-groups";
import { PackingItemForm } from "./packing-item-form";
import { SuitcaseFormDialog } from "./suitcase-form-dialog";
import { DeleteSuitcaseDialog, type DeleteSuitcaseMode } from "./delete-suitcase-dialog";
import { SuitcasePickerDialog } from "./suitcase-picker-dialog";
import { CopyFromTripDialog } from "./copy-from-trip-dialog";
import { SelectionBar } from "./selection-bar";

export type { PackingView };

interface Props {
  tripId: string;
  items: PackingItem[];
  suitcases: Suitcase[];
  unitSystem: UnitSystem;
  tripsToCopy: { id: string; name: string }[];
  initialView: PackingView;
  hasDiveEquipment?: boolean;
}

type PickerPurpose = "defaults" | "dive" | "move";

export function PackingList({ tripId, items, suitcases, unitSystem, tripsToCopy, initialView, hasDiveEquipment = false }: Props) {
  const { t } = useT();
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const [view, setView] = useState<PackingView>(initialView);
  const [query, setQuery] = useState("");
  const [onlyPending, setOnlyPending] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<PackingItem | null>(null);
  const [suitcaseDialog, setSuitcaseDialog] = useState<{ open: boolean; suitcase: Suitcase | null }>({ open: false, suitcase: null });
  const [deletingSuitcase, setDeletingSuitcase] = useState<Suitcase | null>(null);
  const [picker, setPicker] = useState<PickerPurpose | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [isPending, setIsPending] = useState(false);

  const categories = [...new Set([...t.packingPresetCategories, ...items.map((i) => i.category)])];
  const visible = filterPackingItems(items, { query, onlyPending });
  const hasQuery = query.trim() !== "";
  const total = items.length;
  const packed = items.filter((i) => i.packed).length;
  const itemsIn = (suitcaseId: string) => items.filter((i) => i.suitcaseId === suitcaseId);

  async function run(action: () => Promise<unknown>): Promise<boolean> {
    setIsPending(true);
    try {
      await action();
      return true;
    } catch (error) {
      if (isRedirectError(error)) throw error;
      toast.error(t.error);
      return false;
    } finally {
      setIsPending(false);
    }
  }

  function changeView(next: PackingView) {
    document.cookie = `packingView=${next};path=/;max-age=${60 * 60 * 24 * 365};SameSite=Lax`;
    setView(next);
  }

  function exitSelection() {
    setSelecting(false);
    setSelected(new Set());
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // Works on what the search and the filter leave visible; with all of it already
  // selected, it clears the selection.
  function toggleSelectAll() {
    const ids = visible.map((i) => i.id);
    setSelected(ids.length > 0 && ids.every((id) => selected.has(id)) ? new Set() : new Set(ids));
  }

  async function runOnSelection(action: (ids: string[]) => Promise<unknown>) {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (await run(() => action(ids))) exitSelection();
  }

  async function handleDeleteSelected() {
    const ok = await confirm({
      title: t.confirmDeletePackingItems(selected.size),
      confirmLabel: t.delete,
      cancelLabel: t.cancel,
      destructive: true,
    });
    if (ok) await runOnSelection((ids) => deletePackingItems(tripId, ids));
  }

  async function addDefaults(suitcaseId: string | null) {
    if (await run(() => addDefaultPackingItems(tripId, suitcaseId))) toast.success(t.defaultListAddedToast);
  }

  async function addDiveEquipment(suitcaseId: string | null) {
    await run(async () => {
      const { added } = await addDiveEquipmentToPackingList(tripId, suitcaseId);
      toast.success(added > 0 ? t.diveEquipmentAddedToPackingToast(added) : t.diveEquipmentAlreadyInPackingToast);
    });
  }

  // With no bags the only destination is "no bag", so there is nothing to ask.
  function askDestination(purpose: PickerPurpose) {
    if (suitcases.length > 0) { setPicker(purpose); return; }
    if (purpose === "defaults") void addDefaults(null);
    else if (purpose === "dive") void addDiveEquipment(null);
    else void runOnSelection((ids) => movePackingItems(tripId, ids, null));
  }

  function handlePick(suitcaseId: string | null) {
    const purpose = picker;
    setPicker(null);
    if (purpose === "defaults") void addDefaults(suitcaseId);
    else if (purpose === "dive") void addDiveEquipment(suitcaseId);
    else if (purpose === "move") void runOnSelection((ids) => movePackingItems(tripId, ids, suitcaseId));
  }

  async function handleUnpack(suitcase: Suitcase | null) {
    const count = (suitcase ? itemsIn(suitcase.id) : items).filter((i) => i.packed).length;
    const ok = await confirm({
      title: t.confirmUnpackPackingItems(count),
      description: suitcase?.name,
      confirmLabel: t.packingUnpackAll,
      cancelLabel: t.cancel,
    });
    if (ok) await run(() => unpackAllPackingItems(tripId, suitcase ? suitcase.id : undefined));
  }

  async function handleDeleteSuitcase(suitcase: Suitcase) {
    if (itemsIn(suitcase.id).length > 0) { setDeletingSuitcase(suitcase); return; }
    const ok = await confirm({
      title: t.confirmDeleteSuitcase,
      description: suitcase.name,
      confirmLabel: t.delete,
      cancelLabel: t.cancel,
      destructive: true,
    });
    if (ok) await run(() => deleteSuitcase(tripId, suitcase.id, "unassign"));
  }

  async function confirmDeleteSuitcase(mode: DeleteSuitcaseMode) {
    const suitcase = deletingSuitcase;
    setDeletingSuitcase(null);
    if (suitcase) await run(() => deleteSuitcase(tripId, suitcase.id, mode));
  }

  async function handleShare(suitcase: Suitcase) {
    try {
      await navigator.clipboard.writeText(buildSuitcaseShareText(suitcase.name, itemsIn(suitcase.id)));
      toast.success(t.packingShareCopiedToast);
    } catch {
      toast.error(t.error);
    }
  }

  async function handleCopy(sourceTripId: string) {
    const ok = await run(async () => {
      const copied = await copyPackingFromTrip(tripId, sourceTripId);
      toast.success(t.packingCopiedToast(copied.suitcases, copied.items));
    });
    if (ok) setCopyOpen(false);
  }

  const emptyNotice = total > 0 && visible.length === 0
    ? (onlyPending && !hasQuery ? t.packingNothingPending : t.packingNoMatches)
    : null;

  return (
    <div className={`space-y-4 ${selecting ? "pb-40 md:pb-24" : ""}`}>
      <div className="flex items-center gap-3 flex-wrap">
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-2" /> {t.addPackingItem}
        </Button>
        <Button variant="outline" onClick={() => setSuitcaseDialog({ open: true, suitcase: null })}>
          <Luggage className="h-4 w-4 mr-2" /> {t.newSuitcase}
        </Button>
        {total === 0 && (
          <Button variant="outline" onClick={() => askDestination("defaults")} disabled={isPending}>
            <Wand2 className="h-4 w-4 mr-2" /> {t.addDefaultListBtn}
          </Button>
        )}
        {hasDiveEquipment && (
          <Button variant="outline" onClick={() => askDestination("dive")} disabled={isPending}>
            <Anchor className="h-4 w-4 mr-2" /> {t.addDiveEquipmentToPackingBtn}
          </Button>
        )}
        {tripsToCopy.length > 0 && (
          <Button variant="outline" onClick={() => setCopyOpen(true)} disabled={isPending}>
            <Copy className="h-4 w-4 mr-2" /> {t.copyPackingFromTrip}
          </Button>
        )}
        {total > 0 && !selecting && (
          <Button variant="outline" onClick={() => setSelecting(true)}>
            <ListChecks className="h-4 w-4 mr-2" /> {t.packingSelect}
          </Button>
        )}
        {packed > 0 && (
          <Button variant="outline" onClick={() => handleUnpack(null)} disabled={isPending}>
            <PackageX className="h-4 w-4 mr-2" /> {t.packingUnpackAll}
          </Button>
        )}
        {total > 0 && (
          <span className="text-sm text-muted-foreground">
            {packed}/{total} {t.packedCountSuffix(packed)}
          </span>
        )}
      </div>

      {total > 0 && (
        <div className="w-full bg-muted rounded-full h-2">
          <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${(packed / total) * 100}%` }} />
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <Tabs value={view} onValueChange={(v) => (v === "category" || v === "suitcase") && changeView(v)}>
          <TabsList>
            <TabsTrigger value="category">{t.packingViewByCategory}</TabsTrigger>
            <TabsTrigger value="suitcase">{t.packingViewBySuitcase}</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.packingSearchPlaceholder}
            aria-label={t.packingSearchPlaceholder}
            className="pl-8"
          />
        </div>
        <Button variant={onlyPending ? "secondary" : "outline"} aria-pressed={onlyPending} onClick={() => setOnlyPending(!onlyPending)}>
          {t.packingOnlyPending}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="pt-4">
            <PackingItemForm
              categories={categories}
              suitcases={suitcases}
              submitLabel={t.add}
              onSubmit={(formData) => run(() => createPackingItem(tripId, formData))}
              onCancel={() => setShowForm(false)}
            />
          </CardContent>
        </Card>
      )}

      {total === 0 && (view === "category" || suitcases.length === 0) ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-muted-foreground">
            <ShoppingBag className="h-8 w-8 mx-auto mb-3 opacity-50" />
            <p>{t.noPackingItems}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {emptyNotice && <p className="text-sm text-muted-foreground text-center py-4">{emptyNotice}</p>}
          <PackingGroups
            view={view}
            items={items}
            visible={visible}
            suitcases={suitcases}
            unitSystem={unitSystem}
            hasQuery={hasQuery}
            selecting={selecting}
            selected={selected}
            onToggle={(item) => run(() => togglePackingItem(tripId, item.id, !item.packed))}
            onSelect={toggleSelected}
            onEdit={setEditingItem}
            onDelete={(item) => run(() => deletePackingItem(tripId, item.id))}
            onEditSuitcase={(suitcase) => setSuitcaseDialog({ open: true, suitcase })}
            onDeleteSuitcase={handleDeleteSuitcase}
            onUnpackSuitcase={handleUnpack}
            onShareSuitcase={handleShare}
          />
        </>
      )}

      {selecting && (
        <SelectionBar
          count={selected.size}
          isPending={isPending}
          onToggleAll={toggleSelectAll}
          onMove={() => askDestination("move")}
          onSetPacked={(value) => runOnSelection((ids) => setPackedPackingItems(tripId, ids, value))}
          onDelete={handleDeleteSelected}
          onExit={exitSelection}
        />
      )}

      <Dialog open={editingItem !== null} onOpenChange={(open) => { if (!open) setEditingItem(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t.editPackingItem}</DialogTitle>
          </DialogHeader>
          {editingItem && (
            <PackingItemForm
              key={editingItem.id}
              categories={categories}
              suitcases={suitcases}
              item={editingItem}
              submitLabel={t.save}
              onSubmit={async (formData) => {
                const ok = await run(() => updatePackingItem(tripId, editingItem.id, formData));
                if (ok) setEditingItem(null);
                return ok;
              }}
              onCancel={() => setEditingItem(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <SuitcaseFormDialog
        tripId={tripId}
        unitSystem={unitSystem}
        open={suitcaseDialog.open}
        suitcase={suitcaseDialog.suitcase}
        onOpenChange={(open) => setSuitcaseDialog((prev) => ({ ...prev, open }))}
      />
      <DeleteSuitcaseDialog
        open={deletingSuitcase !== null}
        suitcaseName={deletingSuitcase?.name ?? ""}
        itemCount={deletingSuitcase ? itemsIn(deletingSuitcase.id).length : 0}
        onChoose={confirmDeleteSuitcase}
        onCancel={() => setDeletingSuitcase(null)}
      />
      <SuitcasePickerDialog open={picker !== null} suitcases={suitcases} onPick={handlePick} onCancel={() => setPicker(null)} />
      <CopyFromTripDialog
        open={copyOpen}
        trips={tripsToCopy}
        isPending={isPending}
        onPick={handleCopy}
        onCancel={() => setCopyOpen(false)}
      />
      {confirmDialog}
    </div>
  );
}
