/**
 * ProContext — gestiona si el usuario tiene la versión Pro (sin límite de viajes).
 *
 * En producción, isPro se leerá del estado de compra de Google Play Billing.
 * Por ahora es un flag local en memoria para poder desarrollar y probar sin
 * necesidad de una cuenta de Play Store.
 *
 * Para integrar Google Play Billing en el futuro:
 *   1. Instalar expo-in-app-purchases (o react-native-iap)
 *   2. Reemplazar el useState por la verificación del estado de la compra
 *   3. El resto de la app (ProGate, TripsListScreen) no necesita cambios
 */
import React, { createContext, useContext, useState } from "react";

interface ProContextValue {
  isPro: boolean;
  setIsPro: (value: boolean) => void; // solo en dev/settings
}

const ProContext = createContext<ProContextValue | null>(null);

export function ProProvider({ children }: { children: React.ReactNode }) {
  // TODO: reemplazar con verificación de Google Play Billing
  const [isPro, setIsPro] = useState(false);

  return (
    <ProContext.Provider value={{ isPro, setIsPro }}>
      {children}
    </ProContext.Provider>
  );
}

export function usePro(): ProContextValue {
  const ctx = useContext(ProContext);
  if (!ctx) throw new Error("usePro must be used within ProProvider");
  return ctx;
}

export const FREE_TRIP_LIMIT = 1;
