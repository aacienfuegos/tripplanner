import { useState, useCallback } from "react";
import { View, Text, SectionList, TouchableOpacity, Alert, Share } from "react-native";
import { Tabs, useFocusEffect, useGlobalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { buildSuitcaseShareText, filterPackingItems, formatWeight } from "@tripplanner/shared";
import {
  listPackingItems, deletePackingItem, togglePacked, PackingItem,
  movePackingItems, deletePackingItems, setPackedPackingItems, unpackAllPackingItems,
  addDefaultPackingItems, copyPackingFromTrip, listTripsWithPacking,
} from "@/db/packing";
import { listSuitcases, deleteSuitcase, Suitcase } from "@/db/suitcases";
import ImportWizard from "@/components/import/ImportWizard";
import PackingFormModal from "@/components/forms/PackingFormModal";
import SuitcaseFormModal, { useSuitcaseTypeLabel } from "@/components/forms/SuitcaseFormModal";
import PackingListHeader, { type PackingView } from "@/components/packing/PackingListHeader";
import SelectionBar from "@/components/packing/SelectionBar";
import SuitcasePickerModal from "@/components/packing/SuitcasePickerModal";
import CopyFromTripModal from "@/components/packing/CopyFromTripModal";
import SectionHeaderRight from "@/components/SectionHeaderRight";
import SectionFAB from "@/components/SectionFAB";
import { useT } from "@/contexts/I18nContext";
import { useTripLock } from "@/contexts/TripLockContext";
import { useUnits } from "@/contexts/UnitsContext";

const COLOR = "#4f46e5";
const COLOR_BG = "#4f46e518";
const VIEW_KEY = "@tripplanner/packing-view";
const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };

interface Section {
  key: string;
  title: string;
  suitcase?: Suitcase;
  data: PackingItem[];
}

function groupByCategory(items: readonly PackingItem[]): Section[] {
  const map = new Map<string, PackingItem[]>();
  for (const item of items) {
    map.set(item.category, [...(map.get(item.category) ?? []), item]);
  }
  return Array.from(map.entries()).map(([title, data]) => ({ key: `c:${title}`, title, data }));
}

export default function PackingScreen() {
  const { id } = useGlobalSearchParams<{ id: string }>();
  const tripId = Number(id);
  const { t, lang } = useT();
  const { unitSystem } = useUnits();
  const typeLabel = useSuitcaseTypeLabel();
  const { isLocked, guard } = useTripLock();
  const [items, setItems] = useState<PackingItem[]>([]);
  const [suitcases, setSuitcases] = useState<Suitcase[]>([]);
  const [copySources, setCopySources] = useState<{ id: number; name: string }[]>([]);
  const [view, setView] = useState<PackingView>("category");
  const [query, setQuery] = useState("");
  const [onlyPending, setOnlyPending] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set());
  const [importOpen, setImportOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PackingItem | undefined>();
  const [suitcaseFormOpen, setSuitcaseFormOpen] = useState(false);
  const [editingSuitcase, setEditingSuitcase] = useState<Suitcase | undefined>();
  const [picker, setPicker] = useState<"default" | "move" | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);

  const refresh = useCallback(() => {
    setItems(listPackingItems(tripId));
    setSuitcases(listSuitcases(tripId));
    setCopySources(listTripsWithPacking(tripId));
  }, [tripId]);

  useFocusEffect(useCallback(() => {
    refresh();
    setOnlyPending(false);
    setSelecting(false);
    setSelected(new Set());
    AsyncStorage.getItem(VIEW_KEY).then((v) => setView(v === "suitcase" ? "suitcase" : "category"));
  }, [refresh]));

  // Every write goes through the trip lock, and the list is reloaded after it.
  function write(action: () => void) {
    guard(() => { action(); refresh(); });
  }

  function changeView(v: PackingView) {
    setView(v);
    AsyncStorage.setItem(VIEW_KEY, v);
  }

  const filtered = filterPackingItems(items, { query, onlyPending });
  const hasQuery = query.trim() !== "";
  const packedCount = items.filter((i) => i.packed).length;
  const suitcaseNames = new Map(suitcases.map((s) => [s.id, s.name]));
  // Progress counts every item, not just the ones the search and filter leave.
  const stats = new Map<number, { packed: number; total: number }>();
  for (const i of items) {
    if (i.suitcase_id === null) continue;
    const s = stats.get(i.suitcase_id) ?? { packed: 0, total: 0 };
    stats.set(i.suitcase_id, { packed: s.packed + (i.packed ? 1 : 0), total: s.total + 1 });
  }
  const statsOf = (suitcaseId: number) => stats.get(suitcaseId) ?? { packed: 0, total: 0 };

  let sections: Section[];
  if (view === "category") {
    sections = groupByCategory(filtered);
  } else {
    // With a search, bags with no match are hidden; with only the pending
    // filter, a fully packed bag still shows its progress.
    sections = suitcases
      .map((s) => ({ key: `s:${s.id}`, title: s.name, suitcase: s, data: filtered.filter((i) => i.suitcase_id === s.id) }))
      .filter((s) => !hasQuery || s.data.length > 0);
    const loose = filtered.filter((i) => i.suitcase_id === null);
    if (loose.length > 0) sections.push({ key: "none", title: t.noSuitcase, data: loose });
  }

  const notice = items.length > 0 && filtered.length === 0
    ? (onlyPending && !hasQuery ? t.nothingPending : t.noMatchingItems)
    : undefined;

  const visibleIds = filtered.map((i) => i.id);
  const selectedIds = visibleIds.filter((itemId) => selected.has(itemId));

  function exitSelection() {
    setSelecting(false);
    setSelected(new Set());
  }

  function toggleSelected(itemId: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  function selectAll() {
    const all = visibleIds.length > 0 && selectedIds.length === visibleIds.length;
    setSelected(new Set(all ? [] : visibleIds));
  }

  function confirmDeleteSelected() {
    Alert.alert(t.confirmDeleteItems(selectedIds.length), undefined, [
      { text: t.cancel, style: "cancel" },
      { text: t.delete, style: "destructive", onPress: () => { write(() => deletePackingItems(tripId, selectedIds)); exitSelection(); } },
    ]);
  }

  function confirmUnpack(count: number, suitcaseId?: number) {
    if (count === 0) return;
    Alert.alert(t.unpackAll, t.confirmUnpack(count), [
      { text: t.cancel, style: "cancel" },
      { text: t.unmark, onPress: () => write(() => unpackAllPackingItems(tripId, suitcaseId)) },
    ]);
  }

  function confirmDeleteSuitcase(s: Suitcase) {
    const count = statsOf(s.id).total;
    if (count === 0) {
      Alert.alert(t.deleteSuitcaseTitle, s.name, [
        { text: t.cancel, style: "cancel" },
        { text: t.delete, style: "destructive", onPress: () => write(() => deleteSuitcase(tripId, s.id, "unassign")) },
      ]);
      return;
    }
    Alert.alert(t.deleteSuitcaseTitle, `${s.name}\n${t.suitcaseItemCount(count)}`, [
      { text: t.cancel, style: "cancel" },
      { text: t.unassignSuitcaseItems, onPress: () => write(() => deleteSuitcase(tripId, s.id, "unassign")) },
      { text: t.deleteSuitcaseItems, style: "destructive", onPress: () => write(() => deleteSuitcase(tripId, s.id, "deleteItems")) },
    ]);
  }

  function shareSuitcase(s: Suitcase) {
    Share.share({ message: buildSuitcaseShareText(s.name, items.filter((i) => i.suitcase_id === s.id)) });
  }

  function handlePick(suitcaseId: number | null) {
    if (picker === "default") write(() => addDefaultPackingItems(tripId, suitcaseId));
    if (picker === "move") { write(() => movePackingItems(tripId, selectedIds, suitcaseId)); exitSelection(); }
    setPicker(null);
  }

  function handleCopy(sourceTripId: number) {
    setCopyOpen(false);
    write(() => {
      const copied = copyPackingFromTrip(tripId, sourceTripId);
      Alert.alert(t.copyFromTrip, t.copiedSummary(copied.suitcases, copied.items));
    });
  }

  function handleLongPress(item: PackingItem) {
    Alert.alert(item.name, undefined, [
      { text: t.edit, onPress: () => { setEditingItem(item); setFormOpen(true); } },
      { text: t.delete, style: "destructive", onPress: () => write(() => deletePackingItem(item.id)) },
      { text: t.cancel, style: "cancel" },
    ]);
  }

  function openAdd() { setEditingItem(undefined); setFormOpen(true); }
  function closeForm() { setFormOpen(false); setEditingItem(undefined); }
  function openSuitcaseForm(s?: Suitcase) { setEditingSuitcase(s); setSuitcaseFormOpen(true); }
  function closeSuitcaseForm() { setSuitcaseFormOpen(false); setEditingSuitcase(undefined); }

  const actions = selecting ? [] : [
    { key: "suitcase", icon: "add" as const, label: t.newSuitcase, onPress: () => guard(() => openSuitcaseForm()) },
    ...(items.length === 0 ? [{ key: "default", icon: "list-outline" as const, label: t.defaultPackingList, onPress: () => guard(() => setPicker("default")) }] : []),
    ...(copySources.length > 0 ? [{ key: "copy", icon: "copy-outline" as const, label: t.copyFromTrip, onPress: () => guard(() => setCopyOpen(true)) }] : []),
    ...(items.length > 0 ? [{ key: "select", icon: "checkmark-circle-outline" as const, label: t.select, onPress: () => guard(() => setSelecting(true)) }] : []),
    ...(packedCount > 0 ? [{ key: "unpack", icon: "square-outline" as const, label: t.unpackAll, onPress: () => guard(() => confirmUnpack(packedCount)) }] : []),
  ];

  function renderSectionHeader(section: Section) {
    const s = section.suitcase;
    if (!s) {
      return (
        <Text className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 mt-4 px-1">
          {section.title}
        </Text>
      );
    }
    const { packed, total } = statsOf(s.id);
    const details = [typeLabel(s.type), s.weight_grams !== null ? formatWeight(s.weight_grams, unitSystem, lang) : null]
      .filter(Boolean).join("  ·  ");
    return (
      <View className="mt-4 mb-2 px-1">
        <View className="flex-row items-center gap-2">
          <Ionicons name="briefcase-outline" size={16} color={COLOR} />
          <Text className="flex-1 text-base font-semibold text-slate-800 dark:text-slate-100" numberOfLines={1}>{s.name}</Text>
          <Text className="text-sm font-bold" style={{ color: total > 0 && packed === total ? "#059669" : COLOR }}>
            {packed}/{total}
          </Text>
        </View>
        <View className="flex-row items-center justify-between mt-1">
          <Text className="text-xs text-slate-400 dark:text-slate-500">{details}</Text>
          {/* Icons, not an options Alert: Android shows at most three Alert buttons. */}
          {!selecting && (
            <View className="flex-row items-center gap-4">
              <TouchableOpacity onPress={() => guard(() => openSuitcaseForm(s))} hitSlop={HIT_SLOP} accessibilityLabel={t.editSuitcase}>
                <Ionicons name="create-outline" size={18} color="#64748b" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => guard(() => confirmUnpack(packed, s.id))} hitSlop={HIT_SLOP} accessibilityLabel={t.unpackAll}>
                <Ionicons name="square-outline" size={18} color={packed > 0 ? "#64748b" : "#cbd5e1"} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => shareSuitcase(s)} hitSlop={HIT_SLOP} accessibilityLabel={t.share}>
                <Ionicons name="share-social-outline" size={18} color="#64748b" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => guard(() => confirmDeleteSuitcase(s))} hitSlop={HIT_SLOP} accessibilityLabel={t.delete}>
                <Ionicons name="trash-outline" size={18} color="#ef4444" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  }

  function renderItem(item: PackingItem) {
    const isSelected = selected.has(item.id);
    const suitcaseName = view === "category" && item.suitcase_id !== null ? suitcaseNames.get(item.suitcase_id) : undefined;
    return (
      <TouchableOpacity
        onPress={() => selecting ? toggleSelected(item.id) : guard(() => { setEditingItem(item); setFormOpen(true); })}
        onLongPress={selecting ? undefined : () => guard(() => handleLongPress(item))}
        className="bg-white dark:bg-zinc-900 rounded-2xl mb-2 overflow-hidden shadow-sm"
        style={{ borderLeftWidth: 3, borderLeftColor: item.packed ? "#d1fae5" : COLOR }}
        activeOpacity={0.75}
      >
        <View className="px-4 py-3 flex-row items-center gap-3">
          {selecting ? (
            <View className={`w-5 h-5 rounded-full border-2 items-center justify-center flex-shrink-0 ${isSelected ? "bg-indigo-600 border-indigo-600" : "border-slate-300 dark:border-zinc-600"}`}>
              {isSelected ? <Ionicons name="checkmark" size={11} color="white" /> : null}
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => write(() => togglePacked(item.id, !item.packed))}
              hitSlop={HIT_SLOP}
              className={`w-5 h-5 rounded border-2 items-center justify-center flex-shrink-0 ${item.packed ? "bg-emerald-500 border-emerald-500" : "border-slate-300 dark:border-zinc-600"}`}
            >
              {item.packed ? <Ionicons name="checkmark" size={11} color="white" /> : null}
            </TouchableOpacity>
          )}
          <View className="flex-1">
            <Text className={`text-base ${item.packed ? "line-through text-slate-400 dark:text-zinc-600" : "text-slate-900 dark:text-white font-medium"}`}>
              {item.name}{item.quantity > 1 ? <Text className="text-slate-400 dark:text-zinc-500 font-normal"> ×{item.quantity}</Text> : ""}
            </Text>
            {suitcaseName ? <Text className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">{suitcaseName}</Text> : null}
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-zinc-50 dark:bg-zinc-950" edges={["bottom"]}>
      <Tabs.Screen options={{
        title: t.packing,
        headerRight: () => (
          <SectionHeaderRight
            tripId={id} onImportPress={() => setImportOpen(true)}
            locked={isLocked} onLockedPress={() => guard(() => {})}
          />
        ),
      }} />

      <SectionList
        sections={sections}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: selecting ? 140 : 96 }}
        ListHeaderComponent={
          <PackingListHeader
            packed={packedCount} total={items.length}
            showFilters={items.length > 0 || suitcases.length > 0}
            query={query} onQueryChange={setQuery}
            view={view} onViewChange={changeView}
            onlyPending={onlyPending} onOnlyPendingChange={setOnlyPending}
            actions={actions} notice={notice}
          />
        }
        ListEmptyComponent={items.length === 0 ? (
          <View className="items-center py-20">
            <View className="w-16 h-16 rounded-full items-center justify-center mb-3" style={{ backgroundColor: COLOR_BG }}>
              <Ionicons name="briefcase-outline" size={32} color={COLOR} />
            </View>
            <Text className="text-base font-semibold text-slate-700 dark:text-slate-200">{t.packingEmpty}</Text>
            <Text className="mt-1 text-xs text-slate-400 dark:text-slate-500 text-center px-8">{t.packingEmptyHint}</Text>
          </View>
        ) : null}
        renderSectionHeader={({ section }) => renderSectionHeader(section)}
        renderSectionFooter={({ section }) => section.suitcase && statsOf(section.suitcase.id).total === 0 ? (
          <Text className="text-sm text-slate-400 dark:text-zinc-500 px-1 mb-2">{t.suitcaseEmpty}</Text>
        ) : null}
        renderItem={({ item }) => renderItem(item)}
        keyboardShouldPersistTaps="handled"
      />

      {selecting ? (
        <SelectionBar
          count={selectedIds.length}
          onSelectAll={selectAll}
          onMove={() => setPicker("move")}
          onMarkPacked={() => { write(() => setPackedPackingItems(tripId, selectedIds, true)); exitSelection(); }}
          onUnmark={() => { write(() => setPackedPackingItems(tripId, selectedIds, false)); exitSelection(); }}
          onDelete={confirmDeleteSelected}
          onExit={exitSelection}
        />
      ) : (
        <SectionFAB onPress={() => guard(openAdd)} color={COLOR} locked={isLocked} />
      )}

      <ImportWizard tripId={tripId} visible={importOpen} onClose={() => { setImportOpen(false); refresh(); }} />
      <PackingFormModal
        tripId={tripId} visible={formOpen} initialData={editingItem} suitcases={suitcases}
        onClose={closeForm}
        onSaved={() => { closeForm(); refresh(); }}
        onDelete={editingItem ? () => { closeForm(); write(() => deletePackingItem(editingItem.id)); } : undefined}
      />
      <SuitcaseFormModal
        tripId={tripId} visible={suitcaseFormOpen} initialData={editingSuitcase}
        onClose={closeSuitcaseForm}
        onSaved={() => { closeSuitcaseForm(); refresh(); }}
      />
      <SuitcasePickerModal
        visible={picker !== null} suitcases={suitcases}
        onClose={() => setPicker(null)} onPick={handlePick}
      />
      <CopyFromTripModal
        visible={copyOpen} trips={copySources}
        onClose={() => setCopyOpen(false)} onPick={handleCopy}
      />
    </SafeAreaView>
  );
}
