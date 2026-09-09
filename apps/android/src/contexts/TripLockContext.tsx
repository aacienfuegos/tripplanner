import React, { createContext, useContext } from "react";
import { Alert } from "react-native";
import { useT } from "@/contexts/I18nContext";

interface TripLockContextValue {
  isLocked: boolean;
  guard: (action: () => void) => void;
}

const TripLockContext = createContext<TripLockContextValue | null>(null);

export function TripLockProvider({ isLocked, children }: { isLocked: boolean; children: React.ReactNode }) {
  const { t } = useT();

  function guard(action: () => void) {
    if (isLocked) {
      Alert.alert(t.tripLockedTitle, t.tripLockedMsg, [{ text: t.understood }]);
      return;
    }
    action();
  }

  return <TripLockContext.Provider value={{ isLocked, guard }}>{children}</TripLockContext.Provider>;
}

export function useTripLock(): TripLockContextValue {
  const ctx = useContext(TripLockContext);
  if (!ctx) throw new Error("useTripLock must be used within TripLockProvider");
  return ctx;
}
