import { useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from "react-native";

import { AdminShell } from "@/components/e3lani/admin-shell";
import { EmptyState, Field, OutlineButton, PrimaryButton, StatusBadge } from "@/components/e3lani/ui";
import { BRAND } from "@/lib/e3lani-data";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";

export default function Moderation() {
  const { locale } = useI18n();
  const [reason, setReason] = useState(
    locale === "ar" ? "تمت مراجعة المحتوى والروابط والوسائط." : "Content, links, and media were reviewed.",
  );
  const queueQuery = trpc.moderation.queue.useQuery({ limit: 50 });
  const utils = trpc.useUtils();
  const decide = trpc.moderation.decide.useMutation({
    onSuccess: () => void utils.moderation.queue.invalidate(),
  });

  const onDecide = (caseId: number, decision: "approve" | "reject" | "request_changes") => {
    if (reason.trim().length < 4) {
      Alert.alert(locale === "ar" ? "اكتب سبب القرار" : "Enter a decision reason");
      return;
    }
    void decide.mutateAsync({ caseId, decision, reason: reason.trim() });
  };

  const items = queueQuery.data ?? [];

  return (
    <AdminShell title={locale === "ar" ? "مراجعة الإعلانات" : "Ad moderation"}>
      <ScrollView contentContainerStyle={s.page}>
        {queueQuery.isLoading ? <ActivityIndicator color={BRAND.yellowDark} /> : null}
        {items.length ? (
          items.map((item) => (
            <View key={item.caseId} style={s.card}>
              <View style={s.row}>
                <StatusBadge status={item.adStatus} />
                <Text style={s.id}>
                  {item.adPublicId} · case #{item.caseId}
                </Text>
              </View>
              <Text style={s.title}>{item.title ?? item.adPublicId}</Text>
              <Text style={s.meta}>
                {item.countryCode} · risk {item.riskScore} · {item.status}
              </Text>
              {item.decisionReason ? <Text style={s.description}>{item.decisionReason}</Text> : null}
              <Field
                label={locale === "ar" ? "سبب القرار" : "Decision reason"}
                value={reason}
                onChangeText={setReason}
              />
              <View style={s.buttons}>
                <View style={{ flex: 1 }}>
                  <PrimaryButton
                    label={locale === "ar" ? "قبول وتفعيل" : "Approve"}
                    icon="check"
                    onPress={() => onDecide(item.caseId, "approve")}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <OutlineButton
                    label={locale === "ar" ? "طلب تعديل" : "Request changes"}
                    icon="edit"
                    onPress={() => onDecide(item.caseId, "request_changes")}
                  />
                </View>
              </View>
              <OutlineButton
                label={locale === "ar" ? "رفض الإعلان" : "Reject"}
                icon="close"
                onPress={() => onDecide(item.caseId, "reject")}
              />
            </View>
          ))
        ) : !queueQuery.isLoading ? (
          <EmptyState
            icon="fact-check"
            title={locale === "ar" ? "قائمة المراجعة فارغة" : "Review queue is empty"}
            text={
              locale === "ar"
                ? "ستظهر هنا حالات المراجعة من الخادم (queued / appealed)."
                : "Server moderation cases (queued / appealed) will appear here."
            }
          />
        ) : null}
      </ScrollView>
    </AdminShell>
  );
}

const s = StyleSheet.create({
  page: { padding: 16, paddingBottom: 35, gap: 12 },
  card: {
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 22,
    padding: 16,
    backgroundColor: BRAND.white,
  },
  row: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" },
  id: { color: BRAND.muted, fontSize: 11 },
  title: {
    marginTop: 12,
    color: BRAND.black,
    fontSize: 19,
    lineHeight: 27,
    fontWeight: "900",
    textAlign: "right",
  },
  meta: { marginTop: 4, color: BRAND.muted, fontSize: 12, textAlign: "right" },
  description: { marginTop: 5, color: BRAND.muted, fontSize: 13, lineHeight: 21, textAlign: "right" },
  buttons: { marginTop: 10, flexDirection: "row-reverse", gap: 8 },
});
