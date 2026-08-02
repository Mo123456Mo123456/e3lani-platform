import { useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";

import { AdminShell } from "@/components/e3lani/admin-shell";
import { EmptyState, Field, OutlineButton, PrimaryButton } from "@/components/e3lani/ui";
import { BRAND } from "@/lib/e3lani-data";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";

export default function Reports() {
  const { locale } = useI18n();
  const [note, setNote] = useState("تمت مراجعة البلاغ واتخاذ الإجراء المناسب.");
  const reports = trpc.admin.reports.useQuery({ limit: 200 });
  const utils = trpc.useUtils();
  const decide = trpc.admin.decideReport.useMutation({
    onSuccess: () => void utils.admin.reports.invalidate(),
  });
  const act = (
    reportId: string,
    action: "dismiss" | "resolve" | "remove_content" | "restore_content" | "suspend_reporter",
  ) => void decide.mutateAsync({ reportId, action, reason: note });
  const items = reports.data ?? [];

  return (
    <AdminShell title={locale === "ar" ? "البلاغات" : "Reports"}>
      <ScrollView contentContainerStyle={s.page}>
        {reports.isLoading ? <ActivityIndicator color={BRAND.yellowDark} /> : null}
        {items.length ? items.map((report) => (
          <View key={report.id} style={s.card}>
            <View style={s.row}>
              <Text style={s.reason}>{report.reason}</Text>
              <Text style={s.id}>{report.id}</Text>
            </View>
            <Text style={s.meta}>
              {report.contentType} · {report.contentId ?? "—"} · {report.contentStatus ?? "—"} · {new Date(report.createdAt).toLocaleDateString()}
            </Text>
            <Text style={s.meta}>
              {locale === "ar" ? "المبلّغ" : "Reporter"}: {report.reporterType}
              {report.reporterName ? ` · ${report.reporterName}` : ""}
              {report.reporterUserId ? ` · #${report.reporterUserId}` : ""}
              {report.reporterVisitorSessionId ? ` · #${report.reporterVisitorSessionId}` : ""}
            </Text>
            {report.details ? <Text style={s.details}>{report.details}</Text> : null}
            <Field label={locale === "ar" ? "سبب القرار" : "Decision reason"} value={note} onChangeText={setNote} />
            <View style={s.actions}>
              <PrimaryButton label={locale === "ar" ? "حل البلاغ" : "Resolve"} icon="done-all" onPress={() => act(report.id, "resolve")} />
              <OutlineButton label={locale === "ar" ? "رفض البلاغ" : "Dismiss"} icon="close" onPress={() => act(report.id, "dismiss")} />
              <OutlineButton label={locale === "ar" ? "إزالة المحتوى" : "Remove content"} icon="delete" onPress={() => act(report.id, "remove_content")} />
              {report.reporterType !== "unknown" ? (
                <OutlineButton label={locale === "ar" ? "إيقاف المبلّغ المسيء" : "Suspend abusive reporter"} icon="block" onPress={() => act(report.id, "suspend_reporter")} />
              ) : null}
            </View>
          </View>
        )) : !reports.isLoading ? (
          <EmptyState icon="flag" title={locale === "ar" ? "لا توجد بلاغات مفتوحة" : "No open reports"} text={locale === "ar" ? "تمت معالجة جميع البلاغات الحالية." : "All current reports have been resolved."} />
        ) : null}
      </ScrollView>
    </AdminShell>
  );
}

const s = StyleSheet.create({
  page: { padding: 16, paddingBottom: 35, gap: 12 },
  card: { borderWidth: 1, borderColor: BRAND.border, borderRadius: 20, padding: 16, backgroundColor: BRAND.white },
  row: { flexDirection: "row-reverse", justifyContent: "space-between", gap: 8 },
  reason: { flex: 1, color: BRAND.black, fontSize: 17, lineHeight: 24, fontWeight: "900", textAlign: "right" },
  id: { color: BRAND.muted, fontSize: 11 },
  meta: { marginTop: 5, color: BRAND.muted, fontSize: 11, textAlign: "right" },
  details: { marginTop: 8, color: BRAND.black, fontSize: 13, lineHeight: 21, textAlign: "right" },
  actions: { marginTop: 10, gap: 8 },
});
