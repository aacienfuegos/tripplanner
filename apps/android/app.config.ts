import type { ExpoConfig, ConfigContext } from "expo/config";

type AppVariant = "full" | "dive-public";

const APP_VARIANT: AppVariant = process.env.APP_VARIANT === "dive-public" ? "dive-public" : "full";
const SYNC_ENABLED = process.env.SYNC_ENABLED === "true";

// Ambos módulos (Trips y Dives) se compilan en todas las variantes — la
// diferencia es solo identidad de store + ruta por defecto + inclusión de
// sync, no scope de features. Ver issue #288.
const VARIANTS: Record<
  AppVariant,
  {
    name: string;
    slug: string;
    scheme: string;
    androidPackage: string;
    assetsDir: string;
    backgroundColor: string;
  }
> = {
  full: {
    name: "TripPlanner",
    slug: "tripplanner",
    scheme: "tripplanner",
    androidPackage: "com.aacienfuegos.tripplanner",
    assetsDir: "./assets/full",
    backgroundColor: "#1D6FDC",
  },
  "dive-public": {
    name: "Sub",
    slug: "sub",
    scheme: "sub",
    androidPackage: "com.aacienfuegos.sub",
    assetsDir: "./assets/sub",
    backgroundColor: "#0B4965",
  },
};

export default ({ config }: ConfigContext): ExpoConfig => {
  const variant = VARIANTS[APP_VARIANT];

  return {
    ...config,
    name: variant.name,
    slug: variant.slug,
    version: "1.0.0",
    orientation: "portrait",
    scheme: variant.scheme,
    icon: `${variant.assetsDir}/icon.png`,
    userInterfaceStyle: "automatic",
    android: {
      adaptiveIcon: {
        foregroundImage: `${variant.assetsDir}/adaptive-icon.png`,
        backgroundColor: variant.backgroundColor,
      },
      package: variant.androidPackage,
      allowBackup: false,
    },
    plugins: [
      "expo-router",
      [
        "expo-sqlite",
        {
          enableFTS: false,
          useSQLCipher: false,
        },
      ],
      "@react-native-community/datetimepicker",
      "expo-secure-store",
      "expo-localization",
      "expo-status-bar",
      [
        "expo-splash-screen",
        {
          image: `${variant.assetsDir}/splash-icon.png`,
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: variant.backgroundColor,
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      appVariant: APP_VARIANT,
      syncEnabled: SYNC_ENABLED,
    },
  };
};
