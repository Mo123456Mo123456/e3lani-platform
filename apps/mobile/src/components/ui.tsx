import * as React from 'react';
import {
  ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View,
  type PressableProps, type TextInputProps, type ViewStyle,
} from 'react-native';
import { Image } from 'expo-image';
import { theme } from '@/lib/theme';

export function Button({
  title,
  variant = 'primary',
  loading,
  style,
  disabled,
  ...props
}: PressableProps & {
  title: string;
  variant?: 'primary' | 'outline' | 'ghost' | 'danger';
  loading?: boolean;
  style?: ViewStyle;
}) {
  const palette = {
    primary: { bg: theme.colors.primary, fg: theme.colors.ink, border: 'transparent' },
    outline: { bg: theme.colors.white, fg: theme.colors.ink, border: theme.colors.border },
    ghost: { bg: 'transparent', fg: theme.colors.inkMuted, border: 'transparent' },
    danger: { bg: theme.colors.danger, fg: theme.colors.white, border: 'transparent' },
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          opacity: disabled || loading ? 0.55 : pressed ? 0.85 : 1,
        },
        style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} size="small" />
      ) : (
        <Text style={[styles.buttonText, { color: palette.fg }]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Field({
  label,
  error,
  hint,
  style,
  ...props
}: TextInputProps & { label?: string; error?: string | null; hint?: string; style?: ViewStyle }) {
  return (
    <View style={[{ width: '100%' }, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor="#9A9A9A"
        style={[styles.input, error ? { borderColor: theme.colors.danger } : null]}
        {...props}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!error && hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Badge({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'primary' | 'success' | 'danger' | 'warning';
}) {
  const colors = {
    neutral: { bg: theme.colors.surface, fg: theme.colors.inkMuted },
    primary: { bg: theme.colors.primary, fg: theme.colors.ink },
    success: { bg: '#E7F6EE', fg: theme.colors.success },
    danger: { bg: '#FDECEC', fg: theme.colors.danger },
    warning: { bg: '#FEF3DC', fg: '#8A6100' },
  }[tone];

  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }]}>
      <Text style={[styles.badgeText, { color: colors.fg }]}>{label}</Text>
    </View>
  );
}

export function Avatar({
  uri,
  name,
  size = 40,
}: {
  uri?: string | null;
  name?: string | null;
  size?: number;
}) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        contentFit="cover"
        transition={200}
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: theme.colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: size * 0.42, fontWeight: '700', color: theme.colors.inkMuted }}>
        {(name ?? '؟').trim().charAt(0)}
      </Text>
    </View>
  );
}

export function Loading({ label }: { label?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={theme.colors.primary} size="large" />
      {label ? <Text style={[theme.text.caption, { marginTop: 8 }]}>{label}</Text> : null}
    </View>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.empty}>
      <Text style={theme.text.subtitle}>{title}</Text>
      {description ? (
        <Text style={[theme.text.caption, { textAlign: 'center', marginTop: 6 }]}>{description}</Text>
      ) : null}
      {action ? <View style={{ marginTop: 12 }}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 48,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    flexDirection: 'row',
    gap: 8,
  },
  buttonText: { fontSize: 15, fontWeight: '700' },
  label: { fontSize: 13, fontWeight: '600', color: theme.colors.ink, marginBottom: 6 },
  input: {
    height: 48,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.white,
    paddingHorizontal: 14,
    fontSize: 15,
    color: theme.colors.ink,
    textAlign: 'right',
  },
  error: { color: theme.colors.danger, fontSize: 12, marginTop: 4 },
  hint: { color: theme.colors.inkMuted, fontSize: 12, marginTop: 4 },
  card: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
  },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.colors.border,
    margin: 16,
  },
});
