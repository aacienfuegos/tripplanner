import { useState, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, Alert } from "react-native";
import { Tabs, useFocusEffect, useGlobalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { listDocuments, deleteDocument, Document } from "@/db/documents";
import ImportWizard from "@/components/import/ImportWizard";
import DocumentFormModal from "@/components/forms/DocumentFormModal";
import SectionHeaderRight from "@/components/SectionHeaderRight";
import SectionFAB from "@/components/SectionFAB";
import { useT } from "@/contexts/I18nContext";
import { useTripLock } from "@/contexts/TripLockContext";

const COLOR = "#0e7490";
const COLOR_BG = "#0e749018";

const TYPE_ICONS: Record<string, string> = {
  PASSPORT: "id-card-outline", VISA: "stamp-outline", INSURANCE: "shield-checkmark-outline",
  TICKET: "ticket-outline", VOUCHER: "pricetag-outline", OTHER: "document-outline",
};

function expiryStatus(expiresAt: string | null): "expired" | "soon" | "ok" | null {
  if (!expiresAt) return null;
  const today = new Date();
  const exp = new Date(expiresAt + "T00:00:00");
  const diffDays = Math.ceil((exp.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0) return "expired";
  if (diffDays <= 30) return "soon";
  return "ok";
}

function formatDate(iso: string, lang: string): string {
  const locale = lang === "es" ? "es-ES" : "en-US";
  return new Date(iso + "T00:00:00").toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
}

export default function DocumentsScreen() {
  const { id } = useGlobalSearchParams<{ id: string }>();
  const tripId = Number(id);
  const { t, lang } = useT();
  const { isLocked, guard } = useTripLock();
  const [items, setItems] = useState<Document[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Document | undefined>();

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    listDocuments(tripId).then((docs) => { if (!cancelled) setItems(docs); });
    return () => { cancelled = true; };
  }, [tripId]));

  function openEdit(item: Document) { setEditingItem(item); setFormOpen(true); }
  function openAdd() { setEditingItem(undefined); setFormOpen(true); }
  function closeForm() { setFormOpen(false); setEditingItem(undefined); }
  function refresh() { listDocuments(tripId).then(setItems); }

  const typeLabels: Record<string, string> = {
    PASSPORT: t.docPassport, VISA: t.docVisa, INSURANCE: t.docInsurance,
    TICKET: t.docTicket, VOUCHER: t.docVoucher, OTHER: t.docOther,
  };

  return (
    <SafeAreaView className="flex-1 bg-zinc-50 dark:bg-zinc-950" edges={["bottom"]}>
      <Tabs.Screen options={{
        title: t.documents,
        headerRight: () => (
          <SectionHeaderRight
            tripId={id!} onImportPress={() => setImportOpen(true)}
            locked={isLocked} onLockedPress={() => guard(() => {})}
          />
        ),
      }} />

      <FlatList
        data={items}
        keyExtractor={(d) => String(d.id)}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 96 }}
        ListEmptyComponent={
          <View className="items-center py-20">
            <View className="w-16 h-16 rounded-full items-center justify-center mb-3" style={{ backgroundColor: COLOR_BG }}>
              <Ionicons name="document-text-outline" size={32} color={COLOR} />
            </View>
            <Text className="text-base font-semibold text-slate-700 dark:text-slate-200">{t.noDocuments}</Text>
            <Text className="mt-1 text-xs text-slate-400 dark:text-slate-500 text-center px-8">{t.noDocumentsHint}</Text>
          </View>
        }
        renderItem={({ item }) => {
          const expiry = expiryStatus(item.expires_at);
          const icon = TYPE_ICONS[item.type] ?? "document-outline";
          return (
            <TouchableOpacity
              onPress={() => guard(() => openEdit(item))}
              onLongPress={() => guard(() => Alert.alert(item.name, undefined, [
                { text: t.edit, onPress: () => openEdit(item) },
                { text: t.delete, style: "destructive", onPress: () => { deleteDocument(item.id); refresh(); } },
                { text: t.cancel, style: "cancel" },
              ]))}
              className="bg-white dark:bg-zinc-900 rounded-2xl mb-3 overflow-hidden shadow-sm"
              style={{ borderLeftWidth: 3, borderLeftColor: expiry === "expired" || expiry === "soon" ? "#ef4444" : COLOR }}
              activeOpacity={0.75}
            >
              <View className="px-4 py-3.5 flex-row items-center gap-3">
                <View className="w-10 h-10 rounded-xl items-center justify-center flex-shrink-0" style={{ backgroundColor: COLOR_BG }}>
                  <Ionicons name={icon as any} size={20} color={COLOR} />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-bold text-slate-900 dark:text-white" numberOfLines={1}>{item.name}</Text>
                  <View className="flex-row items-center gap-2 mt-0.5 flex-wrap">
                    <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: COLOR_BG }}>
                      <Text className="text-xs font-medium" style={{ color: COLOR }}>
                        {typeLabels[item.type] ?? item.type}
                      </Text>
                    </View>
                    {item.expires_at && (
                      <Text className={`text-xs font-medium ${expiry === "expired" ? "text-red-500" : expiry === "soon" ? "text-orange-500" : "text-slate-400 dark:text-slate-500"}`}>
                        {expiry === "expired" ? t.expired : expiry === "soon" ? t.expiresSoon : t.expires}
                        {" · "}{formatDate(item.expires_at, lang)}
                      </Text>
                    )}
                  </View>
                  {item.notes && (
                    <Text className="text-xs text-slate-400 dark:text-slate-500 mt-1" numberOfLines={1}>{item.notes}</Text>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      <SectionFAB onPress={() => guard(openAdd)} color={COLOR} locked={isLocked} />

      <ImportWizard tripId={tripId} visible={importOpen} onClose={() => { setImportOpen(false); refresh(); }} />
      <DocumentFormModal
        tripId={tripId} visible={formOpen} initialData={editingItem}
        onClose={closeForm}
        onSaved={() => { closeForm(); refresh(); }}
        onDelete={editingItem ? () => { deleteDocument(editingItem.id); closeForm(); refresh(); } : undefined}
      />
    </SafeAreaView>
  );
}
