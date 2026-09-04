import { I18nManager, Platform, StyleSheet } from 'react-native';

/** العربية RTL هي الاتجاه الأساسي للتطبيق. */
export function enforceRtl(): void {
  try {
    I18nManager.allowRTL(true);
    I18nManager.forceRTL(true);
  } catch {
    /* بعض المنصات لا تسمح بالتبديل وقت التشغيل */
  }
}

export const C = {
  primary: '#0F4C4A',
  primaryDark: '#0B3A38',
  accent: '#1FA97A',
  success: '#16A34A',
  successBg: '#ECFDF5',
  warning: '#D97706',
  warningBg: '#FFFBEB',
  danger: '#DC2626',
  dangerBg: '#FEF2F2',
  text: '#111827',
  muted: '#6B7280',
  soft: '#9CA3AF',
  line: '#E5E7EB',
  bg: '#F5F7F7',
  surface: '#FFFFFF',
  white: '#FFFFFF',
} as const;

export const F = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  default: 'System',
});

export const S = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  pad: { padding: 18 },

  h1: { fontSize: 26, fontWeight: '700', color: C.text, textAlign: 'right' },
  h2: { fontSize: 18, fontWeight: '700', color: C.text, textAlign: 'right' },
  body: { fontSize: 15, color: C.text, textAlign: 'right', lineHeight: 24 },
  muted: { fontSize: 13, color: C.muted, textAlign: 'right' },
  tiny: { fontSize: 11.5, color: C.soft, textAlign: 'right' },

  card: {
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: C.line,
  },

  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: C.surface,
    color: C.text,
    textAlign: 'right',
  },

  btn: {
    backgroundColor: C.primary,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { color: C.white, fontSize: 16, fontWeight: '700' },
  btnGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
  },
  btnGhostText: { color: C.text, fontSize: 15, fontWeight: '600' },

  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  pill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  pillText: { fontSize: 12.5, fontWeight: '700' },
});
