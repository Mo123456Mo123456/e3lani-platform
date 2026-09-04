import type { ExpoConfig } from 'expo/config';

/**
 * إعداد تطبيق العامل.
 *
 * `VERO_API_URL` يُضبط وقت البناء ليشير إلى خادم الشركة. لو تُرك فارغًا،
 * يطلب التطبيق من الفني إدخال العنوان مرة واحدة في شاشة التفعيل.
 * لا يوجد أي خادم افتراضي تابع للمطوّر.
 */
const config: ExpoConfig = {
  name: 'VERO',
  slug: 'vero-worker',
  version: '1.0.0',
  orientation: 'portrait',
  scheme: 'vero',
  userInterfaceStyle: 'light',
  newArchEnabled: true,

  splash: {
    backgroundColor: '#0F4C4A',
    resizeMode: 'contain',
  },

  assetBundlePatterns: ['**/*'],

  ios: {
    supportsTablet: false,
    bundleIdentifier: process.env.VERO_IOS_BUNDLE_ID ?? 'com.example.vero',
    infoPlist: {
      NSCameraUsageDescription:
        'تُستخدم الكاميرا لمسح رمز QR الخاص بالحاوية لإثبات تنفيذ الخدمة.',
      NSLocationWhenInUseUsageDescription:
        'يُستخدم الموقع لإثبات أن الزيارة تمت عند موقع الحاوية، وأثناء جلسة العمل فقط.',
      ITSAppUsesNonExemptEncryption: false,
    },
  },

  android: {
    package: process.env.VERO_ANDROID_PACKAGE ?? 'com.example.vero',
    adaptiveIcon: { backgroundColor: '#0F4C4A' },
    permissions: ['CAMERA', 'ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION', 'INTERNET'],
  },

  plugins: [
    'expo-router',
    [
      'expo-build-properties',
      {
        // النظام مُستضاف ذاتيًا وقد يعمل على HTTP داخل شبكة الشركة الداخلية.
        // في النشر العام استخدم HTTPS واضبط هذه القيمة على false.
        android: { usesCleartextTraffic: true },
      },
    ],
    'expo-secure-store',
    'expo-sqlite',
    [
      'expo-camera',
      { cameraPermission: 'تُستخدم الكاميرا لمسح رمز QR الخاص بالحاوية.' },
    ],
    [
      'expo-location',
      {
        locationAlwaysAndWhenInUsePermission:
          'يُستخدم الموقع لإثبات الزيارة وتسجيل خط سير السيارة أثناء جلسة العمل فقط.',
      },
    ],
  ],

  extra: {
    apiUrl: process.env.VERO_API_URL ?? '',
    router: { origin: false },
  },
};

export default config;
