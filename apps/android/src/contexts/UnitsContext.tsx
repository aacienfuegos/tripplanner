import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { UnitSystem } from "@tripplanner/shared";

const STORAGE_KEY = "@tripplanner/unit-system";

interface UnitsContextValue {
  unitSystem: UnitSystem;
  setUnitSystem: (u: UnitSystem) => void;
}

const UnitsContext = createContext<UnitsContextValue>({
  unitSystem: "METRIC",
  setUnitSystem: () => {},
});

export function UnitsProvider({ children }: { children: React.ReactNode }) {
  const [unitSystem, setUnitSystemState] = useState<UnitSystem>("METRIC");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === "METRIC" || stored === "IMPERIAL") setUnitSystemState(stored);
    });
  }, []);

  function setUnitSystem(u: UnitSystem) {
    setUnitSystemState(u);
    AsyncStorage.setItem(STORAGE_KEY, u);
  }

  return (
    <UnitsContext.Provider value={{ unitSystem, setUnitSystem }}>
      {children}
    </UnitsContext.Provider>
  );
}

export function useUnits() {
  return useContext(UnitsContext);
}
