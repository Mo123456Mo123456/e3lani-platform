import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";

import { AdminShell } from "@/components/e3lani/admin-shell";
import { EmptyState } from "@/components/e3lani/ui";
import { BRAND } from "@/lib/e3lani-data";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";

export default function Audit() {
  const { locale } = useI18n();
  const auditQuery = trpc.admin.audit.useQuery({ limit: 100 });

  return (
    <AdminShell title={locale === "ar" ? "سجل التدقيق" : "Audit log"}>
      <ScrollView contentContainerStyle={s.page}>
        {auditQuery.isLoading ? <ActivityIndicator color={BRAND.yellowDark} /> : null}
        {(auditQuery.data ?? []).length ? (
          (auditQuery.data ?? []).map((entry) => (
            <View key={entry.id} style={s.item}>
              <View style={s.line} />
              <View style={s.copy}>
                <Text style={s.action}>{entry.action}</Text>
                <Text style={s.target}>
                  {entry.entityType}:{entry.entityId} • {entry.actorRole ?? "—"} #{entry.actorId ?? "—"}
                </Text>
                {entry.reason ? <Text style={s.reason}>{entry.reason}</Text> : null}
                <Text style={s.date}>{new Date(entry.createdAt).toLocaleString()}</Text>
              </View>
            </View>
          ))
        ) : !auditQuery.isLoading ? (
          <EmptyState
            icon="history"
            title={locale === "ar" ? "لا توجد سجلات بعد" : "No audit entries yet"}
            text={
              locale === "ar"
                ? "ستظهر الإجراءات الإدارية الحساسة هنا من قاعدة البيانات."
                : "Sensitive administrative actions from the database will appear here."
            }
          />
        ) : null}
      </ScrollView>
    </AdminShell>
  );
}

const s = StyleSheet.create({
  page: { padding: 16, paddingBottom: 35, gap: 10 },
  item: {
    flexDirection: "row-reverse",
    gap: 12,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 18,
    padding: 14,
    backgroundColor: BRAND.white,
  },
  line: { width: 5, borderRadius: 3, backgroundColor: BRAND.yellow },
  copy: { flex: 1 },
  action: { color: BRAND.black, fontSize: 14, lineHeight: 20, fontWeight: "900", textAlign: "right" },
  target: { marginTop: 2, color: BRAND.muted, fontSize: 11, textAlign: "right" },
  reason: { marginTop: 7, color: BRAND.black, fontSize: 12, lineHeight: 19, textAlign: "right" },
  date: { marginTop: 5, color: BRAND.muted, fontSize: 10, textAlign: "right" },
});
