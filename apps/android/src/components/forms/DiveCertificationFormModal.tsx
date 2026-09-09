import { useState, useEffect } from "react";
import {
  Modal, View, Text, TextInput, TouchableOpacity, Alert,
  ScrollView, KeyboardAvoidingView, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "nativewind";
import { createDiveCertification, updateDiveCertification, DiveCertification } from "@/db/dive-certifications";
import DatePickerInput from "@/components/DatePickerInput";
import { useT } from "@/contexts/I18nContext";

interface Props {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  onDelete?: () => void;
  initialData?: DiveCertification;
}

export default function DiveCertificationFormModal({ visible, onClose, onSaved, onDelete, initialData }: Props) {
  const { t } = useT();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const [agency, setAgency] = useState("");
  const [level, setLevel] = useState("");
  const [certNumber, setCertNumber] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [instructorName, setInstructorName] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (visible) {
      setAgency(initialData?.agency ?? "");
      setLevel(initialData?.level ?? "");
      setCertNumber(initialData?.cert_number ?? "");
      setIssueDate(initialData?.issue_date ?? "");
      setInstructorName(initialData?.instructor_name ?? "");
      setNotes(initialData?.notes ?? "");
      setError("");
    }
  }, [visible, initialData]);

  function handleSave() {
    if (!agency.trim()) { setError(t.certAgency); return; }
    if (!level.trim()) { setError(t.certLevel); return; }
    const data = {
      agency: agency.trim(),
      level: level.trim(),
      cert_number: certNumber.trim() || null,
      issue_date: issueDate || null,
      instructor_name: instructorName.trim() || null,
      notes: notes.trim() || null,
    };
    if (initialData) updateDiveCertification(initialData.id, data);
    else createDiveCertification(data);
    onSaved();
  }

  const inputClass = "border border-gray-300 dark:border-zinc-700 rounded-lg px-3 py-2.5 text-base text-gray-900 dark:text-white dark:bg-zinc-900";
  const label = "text-sm font-medium text-gray-700 dark:text-slate-300 mb-1";

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 bg-white dark:bg-zinc-950">
        <View className="flex-row items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-zinc-800">
          <Text className="text-lg font-semibold text-gray-900 dark:text-white">
            {initialData ? t.editCertification : t.addCertification}
          </Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={isDark ? "#a1a1aa" : "#6b7280"} />
          </TouchableOpacity>
        </View>
        <ScrollView className="flex-1 px-5" keyboardShouldPersistTaps="handled">
          <View className="py-4 gap-4">
            <View>
              <Text className={label}>{t.certAgency} *</Text>
              <TextInput className={inputClass} value={agency} onChangeText={(v) => { setAgency(v); setError(""); }} placeholder="PADI, SSI, CMAS…" placeholderTextColor={isDark ? "#52525b" : "#9ca3af"} autoFocus />
            </View>
            <View>
              <Text className={label}>{t.certLevel} *</Text>
              <TextInput className={inputClass} value={level} onChangeText={(v) => { setLevel(v); setError(""); }} placeholder="Open Water, Advanced…" placeholderTextColor={isDark ? "#52525b" : "#9ca3af"} />
              {error ? <Text className="mt-1 text-xs text-red-500">{error}</Text> : null}
            </View>
            <View>
              <Text className={label}>{t.certNumber}</Text>
              <TextInput className={inputClass} value={certNumber} onChangeText={setCertNumber} />
            </View>
            <View>
              <Text className={label}>{t.certIssueDate}</Text>
              <DatePickerInput value={issueDate} onChange={setIssueDate} />
            </View>
            <View>
              <Text className={label}>{t.certInstructorName}</Text>
              <TextInput className={inputClass} value={instructorName} onChangeText={setInstructorName} />
            </View>
            <View>
              <Text className={label}>{t.notes}</Text>
              <TextInput className={inputClass} value={notes} onChangeText={setNotes} multiline numberOfLines={3} />
            </View>
          </View>
        </ScrollView>
        <View className="px-5 pb-8 pt-3 border-t border-gray-100 dark:border-zinc-800 gap-3">
          <TouchableOpacity onPress={handleSave} className="bg-cyan-700 rounded-xl py-3.5 items-center">
            <Text className="text-white font-semibold text-base">{t.save}</Text>
          </TouchableOpacity>
          {initialData && onDelete && (
            <TouchableOpacity
              onPress={() => Alert.alert(t.editCertification, t.confirmDeleteCertification, [
                { text: t.cancel, style: "cancel" },
                { text: t.delete, style: "destructive", onPress: onDelete },
              ])}
              className="py-2 items-center"
            >
              <Text className="text-red-500 font-medium">{t.delete}</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
