import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";

import { BRAND } from "@/lib/e3lani-data";
import { useI18n } from "@/lib/i18n";

export function ScreenTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  const { isRTL } = useI18n();
  return (
    <View style={[styles.titleRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
      <View style={styles.titleCopy}>
        <Text accessibilityRole="header" style={[styles.title, { textAlign: isRTL ? "right" : "left" }]}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { textAlign: isRTL ? "right" : "left" }]}>{subtitle}</Text>
        ) : null}
      </View>
      {action}
    </View>
  );
}

export function PrimaryButton({
  label,
  icon,
  onPress,
  disabled = false,
  tone = "yellow",
}: {
  label: string;
  icon?: React.ComponentProps<typeof MaterialIcons>["name"];
  onPress: () => void;
  disabled?: boolean;
  tone?: "yellow" | "dark" | "danger";
}) {
  const backgroundColor = tone === "dark" ? BRAND.black : tone === "danger" ? BRAND.error : BRAND.yellow;
  const foregroundColor = tone === "yellow" ? BRAND.black : BRAND.white;

  return (
    <Pressable
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primary,
        { backgroundColor, opacity: pressed || disabled ? 0.6 : 1 },
      ]}
    >
      {icon ? <MaterialIcons accessible={false} name={icon} size={21} color={foregroundColor} /> : null}
      <Text style={[styles.primaryText, { color: foregroundColor }]}>{label}</Text>
    </Pressable>
  );
}

export function OutlineButton({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon?: React.ComponentProps<typeof MaterialIcons>["name"];
  onPress: () => void;
}) {
  return (
    <Pressable
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.outline, { opacity: pressed ? 0.6 : 1 }]}
    >
      {icon ? <MaterialIcons accessible={false} name={icon} size={20} color={BRAND.black} /> : null}
      <Text style={styles.outlineText}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, multiline, ...props }: TextInputProps & { label: string }) {
  const { isRTL } = useI18n();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { textAlign: isRTL ? "right" : "left" }]}>{label}</Text>
      <TextInput
        {...props}
        accessibilityLabel={props.accessibilityLabel ?? label}
        multiline={multiline}
        placeholderTextColor={BRAND.muted}
        style={[
          styles.input,
          multiline && styles.multiline,
          { textAlign: isRTL ? "right" : "left" },
          props.style,
        ]}
      />
    </View>
  );
}

export function Pill({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  const body = (
    <View
      style={[
        styles.pill,
        {
          backgroundColor: active ? BRAND.yellow : BRAND.surface,
          borderColor: active ? BRAND.yellowDark : BRAND.border,
        },
      ]}
    >
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );

  return onPress ? (
    <Pressable
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: Boolean(active) }}
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}
    >
      {body}
    </Pressable>
  ) : (
    body
  );
}

export function StatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  const colors: Record<string, string> = {
    active: BRAND.success,
    paid: BRAND.success,
    pending_review: BRAND.warning,
    pending: BRAND.warning,
    paused: BRAND.muted,
    rejected: BRAND.error,
    changes_requested: BRAND.warning,
    awaiting_payment: BRAND.warning,
    draft: BRAND.muted,
    expired: BRAND.muted,
    removed: BRAND.error,
    open: BRAND.error,
    resolved: BRAND.success,
  };
  const keys: Record<string, string> = {
    active: "active",
    paid: "paid",
    pending_review: "pendingReview",
    pending: "pending",
    paused: "paused",
    rejected: "rejected",
    changes_requested: "changesRequested",
    awaiting_payment: "awaitingPayment",
    draft: "draft",
    expired: "expired",
    removed: "removed",
    open: "openStatus",
    resolved: "resolvedStatus",
  };
  const label = keys[status] ? t(keys[status]) : status.replaceAll("_", " ");
  const color = colors[status] ?? BRAND.muted;

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={label}
      style={[styles.badge, { backgroundColor: `${color}18` }]}
    >
      <View accessible={false} style={[styles.badgeDot, { backgroundColor: color }]} />
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  text,
  actionLabel,
  onAction,
}: {
  icon: React.ComponentProps<typeof MaterialIcons>["name"];
  title: string;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.empty} accessibilityLiveRegion="polite">
      <View accessible={false} style={styles.emptyIcon}>
        <MaterialIcons accessible={false} name={icon} size={42} color={BRAND.muted} />
      </View>
      <Text accessibilityRole="header" style={styles.emptyTitle}>
        {title}
      </Text>
      <Text style={styles.emptyText}>{text}</Text>
      {actionLabel && onAction ? <PrimaryButton label={actionLabel} onPress={onAction} /> : null}
    </View>
  );
}

export function MetricCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentProps<typeof MaterialIcons>["name"];
}) {
  const formattedValue = typeof value === "number" ? value.toLocaleString() : value;
  return (
    <View accessible accessibilityLabel={`${label}: ${formattedValue}`} style={styles.metric}>
      <MaterialIcons accessible={false} name={icon} size={22} color={BRAND.yellowDark} />
      <Text style={styles.metricValue}>{formattedValue}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: { alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  titleCopy: { flex: 1 },
  title: { color: BRAND.black, fontSize: 28, lineHeight: 38, fontWeight: "900" },
  subtitle: { color: BRAND.muted, marginTop: 4, fontSize: 14, lineHeight: 22 },
  primary: {
    minHeight: 52,
    borderRadius: 17,
    paddingHorizontal: 18,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryText: { fontSize: 15, lineHeight: 21, fontWeight: "900" },
  outline: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 16,
    paddingHorizontal: 16,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  outlineText: { color: BRAND.black, fontSize: 14, lineHeight: 20, fontWeight: "800" },
  field: { gap: 7 },
  label: { color: BRAND.black, fontSize: 13, lineHeight: 19, fontWeight: "800" },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 16,
    paddingHorizontal: 14,
    color: BRAND.black,
    backgroundColor: BRAND.white,
    fontSize: 15,
    lineHeight: 21,
  },
  multiline: { minHeight: 120, paddingTop: 13, textAlignVertical: "top" },
  pill: {
    minHeight: 38,
    borderWidth: 1,
    borderRadius: 19,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  pillText: { color: BRAND.black, fontSize: 12, lineHeight: 17, fontWeight: "800" },
  badge: {
    alignSelf: "flex-start",
    minHeight: 28,
    borderRadius: 14,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  badgeDot: { width: 7, height: 7, borderRadius: 4 },
  badgeText: { fontSize: 10, lineHeight: 14, fontWeight: "900", textTransform: "uppercase" },
  empty: { minHeight: 320, padding: 28, alignItems: "center", justifyContent: "center" },
  emptyIcon: {
    width: 84,
    height: 84,
    borderRadius: 27,
    backgroundColor: BRAND.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    marginTop: 16,
    color: BRAND.black,
    fontSize: 19,
    lineHeight: 27,
    fontWeight: "900",
    textAlign: "center",
  },
  emptyText: {
    marginTop: 6,
    marginBottom: 18,
    color: BRAND.muted,
    maxWidth: 330,
    fontSize: 13,
    lineHeight: 21,
    textAlign: "center",
  },
  metric: {
    flex: 1,
    minWidth: 140,
    minHeight: 122,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 20,
    padding: 15,
    backgroundColor: BRAND.white,
  },
  metricValue: { marginTop: 10, color: BRAND.black, fontSize: 23, lineHeight: 30, fontWeight: "900" },
  metricLabel: { marginTop: 2, color: BRAND.muted, fontSize: 11, lineHeight: 16 },
});
