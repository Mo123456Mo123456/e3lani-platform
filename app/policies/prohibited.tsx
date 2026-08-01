import { ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { OutlineButton, ScreenTitle } from "@/components/e3lani/ui";
import { ScreenContainer } from "@/components/screen-container";
import { BRAND } from "@/lib/e3lani-data";
import { useI18n } from "@/lib/i18n";

const itemsAr = [
  "المحتوى غير القانوني أو المخالف لأنظمة الدولة المعنية.",
  "الأسلحة والمخدرات والقمار والاحتيال المالي الواضح.",
  "انتحال الهوية أو تقليد علامات تجارية دون حق.",
  "الروابط الضارة أو محاولات التصيد.",
  "الإعلانات المكررة المزعجة أو الإغراق.",
  "المحتوى الجنسي الصريح أو المسيء.",
];

const itemsEn = [
  "Illegal content or content that violates the laws of the relevant country.",
  "Weapons, drugs, gambling, and clear financial fraud.",
  "Impersonation or brand misuse without rights.",
  "Malicious links or phishing attempts.",
  "Spammy duplicate ads.",
  "Explicit sexual or abusive content.",
];

export default function ProhibitedPolicy() {
  const { locale } = useI18n();
  const items = locale === "ar" ? itemsAr : itemsEn;

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} className="px-5">
      <ScrollView contentContainerStyle={styles.page}>
        <ScreenTitle
          title={locale === "ar" ? "المحتوى والإعلانات الممنوعة" : "Prohibited content & ads"}
          subtitle={
            locale === "ar"
              ? "يوافق المستخدم على هذه السياسة عند إنشاء الحساب. يفحص النظام الإعلانات آليًا بعد النشر."
              : "Users accept this policy when creating an account. Ads are scanned automatically after publishing."
          }
        />
        {items.map((item) => (
          <View key={item} style={styles.row}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.text}>{item}</Text>
          </View>
        ))}
        <OutlineButton
          label={locale === "ar" ? "عودة" : "Back"}
          icon="arrow-forward"
          onPress={() => router.back()}
        />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  page: { paddingVertical: 18, paddingBottom: 40, gap: 12 },
  row: { flexDirection: "row-reverse", gap: 8, alignItems: "flex-start" },
  bullet: { color: BRAND.yellowDark, fontSize: 18, fontWeight: "900" },
  text: { flex: 1, color: BRAND.black, fontSize: 14, lineHeight: 22, textAlign: "right" },
});
