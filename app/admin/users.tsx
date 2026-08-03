import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AdminShell } from "@/components/e3lani/admin-shell";
import { Field, OutlineButton, PrimaryButton } from "@/components/e3lani/ui";
import { BRAND } from "@/lib/e3lani-data";
import { useE3lani } from "@/lib/e3lani-store";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";

export default function Users() {
  const store = useE3lani(); const { locale } = useI18n();
  const [subjectType, setSubjectType] = useState<"user" | "visitor">("visitor");
  const [subjectId, setSubjectId] = useState("");
  const [reason, setReason] = useState("");
  const suspend = trpc.admin.setIdentitySuspension.useMutation();
  const apply = async (suspended: boolean) => {
    const numericId = Number.parseInt(subjectId, 10);
    if (!Number.isInteger(numericId) || !reason.trim()) {
      return Alert.alert(locale === "ar" ? "أدخل المعرّف والسبب." : "Enter an ID and reason.");
    }
    try {
      await suspend.mutateAsync({ subjectType, subjectId: numericId, suspended, reason });
      Alert.alert(locale === "ar" ? "تم حفظ الإجراء" : "Action saved");
    } catch (error) {
      Alert.alert(locale === "ar" ? "تعذر حفظ الإجراء" : "Action failed", error instanceof Error ? error.message : undefined);
    }
  };
  return (
    <AdminShell title={locale === "ar" ? "المستخدمون والهويات" : "Users & identities"}>
      <ScrollView contentContainerStyle={s.page}>
        {store.user ? <View style={s.card}><View style={s.avatar}><Text style={s.avatarText}>{store.user.name.slice(0, 1)}</Text></View><Text style={s.name}>{store.user.name}</Text><Text style={s.meta}>{store.user.phone} • {store.user.role}</Text></View> : null}
        <View style={s.card}>
          <Text style={s.label}>{locale === "ar" ? "إيقاف أو استعادة هوية مسيئة" : "Suspend or restore an abusive identity"}</Text>
          <View style={s.roles}>
            {(["visitor", "user"] as const).map((type) => (
              <Pressable key={type} onPress={() => setSubjectType(type)} style={[s.role, subjectType === type && s.roleActive]}>
                <Text style={s.roleText}>{type}</Text>
              </Pressable>
            ))}
          </View>
          <Field label={locale === "ar" ? "المعرّف الداخلي الظاهر للإدارة" : "Admin-visible internal ID"} value={subjectId} onChangeText={setSubjectId} keyboardType="number-pad" />
          <Field label={locale === "ar" ? "سبب الإجراء" : "Action reason"} value={reason} onChangeText={setReason} multiline />
          <PrimaryButton label={locale === "ar" ? "إيقاف الهوية" : "Suspend identity"} icon="block" onPress={() => void apply(true)} />
          <OutlineButton label={locale === "ar" ? "استعادة الهوية" : "Restore identity"} icon="restore" onPress={() => void apply(false)} />
        </View>
      </ScrollView>
    </AdminShell>
  );
}
const s = StyleSheet.create({ page: { padding: 16, paddingBottom: 35, gap: 12 }, card: { borderWidth: 1, borderColor: BRAND.border, borderRadius: 22, padding: 18, backgroundColor: BRAND.white, alignItems: "center", gap: 10 }, avatar: { width: 72, height: 72, borderRadius: 24, backgroundColor: BRAND.yellow, alignItems: "center", justifyContent: "center" }, avatarText: { color: BRAND.black, fontSize: 28, fontWeight: "900" }, name: { marginTop: 12, color: BRAND.black, fontSize: 20, lineHeight: 28, fontWeight: "900" }, meta: { marginTop: 3, color: BRAND.muted, fontSize: 11 }, label: { alignSelf: "stretch", color: BRAND.black, fontSize: 13, fontWeight: "900", textAlign: "right" }, roles: { marginTop: 10, flexDirection: "row-reverse", flexWrap: "wrap", justifyContent: "center", gap: 7 }, role: { minHeight: 38, paddingHorizontal: 12, borderRadius: 14, backgroundColor: BRAND.surface, alignItems: "center", justifyContent: "center" }, roleActive: { backgroundColor: BRAND.yellow }, roleText: { color: BRAND.black, fontSize: 11, fontWeight: "900" } });
