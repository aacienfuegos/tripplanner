import { Redirect } from "expo-router";
import Constants from "expo-constants";

export default function Index() {
  // dive-public (Sub) arranca en el módulo de buceo; el resto (full) en trips.
  // Ver app.config.ts / issue #288.
  if (Constants.expoConfig?.extra?.appVariant === "dive-public") {
    return <Redirect href="/dives" />;
  }
  return <Redirect href="/trips" />;
}
