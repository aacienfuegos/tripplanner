import { useState } from "react";
import { TouchableOpacity, Text, View } from "react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";

interface Props {
  value: string;
  onChange: (v: string) => void;
  mode?: "date" | "datetime";
  placeholder?: string;
}

export default function DatePickerInput({
  value,
  onChange,
  mode = "date",
  placeholder = "Seleccionar fecha",
}: Props) {
  const [show, setShow] = useState(false);
  const [phase, setPhase] = useState<"date" | "time">("date");

  const parsed = value ? new Date(value) : new Date();
  const isValid = value ? !isNaN(parsed.getTime()) : false;
  const date = isValid ? parsed : new Date();

  const displayText = value
    ? mode === "datetime"
      ? value.slice(0, 16).replace("T", " ")
      : value.slice(0, 10)
    : null;

  function handleChange(_event: DateTimePickerEvent, selected?: Date) {
    setShow(false);
    if (!selected || _event.type === "dismissed") {
      setPhase("date");
      return;
    }

    if (mode === "datetime") {
      if (phase === "date") {
        const dateStr = selected.toISOString().slice(0, 10);
        const existingTime = value.includes("T") ? value.slice(11, 16) : "00:00";
        onChange(dateStr + "T" + existingTime);
        setPhase("time");
        setShow(true);
      } else {
        const existingDate = value.includes("T") ? value.slice(0, 10) : value || new Date().toISOString().slice(0, 10);
        const h = String(selected.getHours()).padStart(2, "0");
        const m = String(selected.getMinutes()).padStart(2, "0");
        onChange(existingDate + "T" + h + ":" + m);
        setPhase("date");
      }
    } else {
      onChange(selected.toISOString().slice(0, 10));
    }
  }

  function handlePress() {
    setPhase("date");
    setShow(true);
  }

  return (
    <View>
      <TouchableOpacity
        onPress={handlePress}
        className="border border-gray-300 rounded-lg px-3 py-2.5 flex-row items-center justify-between bg-white"
      >
        <Text className={displayText ? "text-base text-gray-900" : "text-base text-gray-400"}>
          {displayText ?? placeholder}
        </Text>
        <Ionicons name="calendar-outline" size={18} color="#9ca3af" />
      </TouchableOpacity>
      {show && (
        <DateTimePicker
          value={date}
          mode={mode === "datetime" ? (phase === "date" ? "date" : "time") : "date"}
          onChange={handleChange}
          display="default"
        />
      )}
    </View>
  );
}
