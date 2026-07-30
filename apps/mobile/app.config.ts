import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "إعلاني",
  slug: "e3lani",
  version: "1.0.0",
  orientation: "portrait",
  scheme: "e3lani",
  icon: "../../assets/images/icon.png",
  userInterfaceStyle: "light",
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    bundleIdentifier: "sa.e3lani.app",
    infoPlist: { ITSAppUsesNonExemptEncryption: false },
  },
  android: {
    package: "sa.e3lani.app",
    edgeToEdgeEnabled: true,
    adaptiveIcon: {
      foregroundImage: "../../assets/images/android-icon-foreground.png",
      backgroundColor: "#111111",
    },
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [{ scheme: "https", host: "e3lani.sa", pathPrefix: "/" }],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    [
      "expo-image-picker",
      {
        photosPermission: "يحتاج إعلاني للوصول إلى الصور والفيديو الذي تختاره لإعلانك.",
        cameraPermission: false,
        microphonePermission: false,
      },
    ],
    [
      "expo-splash-screen",
      {
        image: "../../assets/images/splash-icon.png",
        imageWidth: 180,
        resizeMode: "contain",
        backgroundColor: "#FFFFFF",
      },
    ],
  ],
  experiments: { typedRoutes: true },
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000/api/v1",
  },
};

export default config;
