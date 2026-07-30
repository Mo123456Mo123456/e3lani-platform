import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "إعلاني | E3lani",
  slug: "e3lani",
  scheme: "e3lani",
  version: "2.0.0",
  orientation: "portrait",
  userInterfaceStyle: "light",
  plugins: [
    "expo-router",
    "expo-secure-store",
    [
      "expo-image-picker",
      {
        photosPermission: "نحتاج الوصول للصور لإرفاقها بإعلانك أو منشورك.",
      },
    ],
  ],
  ios: {
    supportsTablet: true,
    bundleIdentifier: "sa.e3lani.app",
  },
  android: {
    package: "sa.e3lani.app",
  },
  experiments: {
    typedRoutes: true,
  },
};

export default config;
