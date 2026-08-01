import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { AdminShell } from "@/components/e3lani/admin-shell";
import { Field, PrimaryButton } from "@/components/e3lani/ui";
import { BRAND } from "@/lib/e3lani-data";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";

export default function AdminPricing() {
  const { locale } = useI18n();
  const utils = trpc.useUtils();
  const rulesQuery = trpc.product.listPricingRules.useQuery();
  const upsert = trpc.product.upsertPricingRule.useMutation({
    onSuccess: async () => {
      await utils.product.listPricingRules.invalidate();
      await utils.product.quote.invalidate();
    },
  });

  const [name, setName] = useState("Country offer");
  const [countryCode, setCountryCode] = useState("SA");
  const [basePrice, setBasePrice] = useState("5900");
  const [discountPrice, setDiscountPrice] = useState("2900");
  const [currency, setCurrency] = useState("SAR");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [message, setMessage] = useState("");

  const save = async () => {
    try {
      await upsert.mutateAsync({
        name,
        scopeType: "country",
        countryCode: countryCode.toUpperCase(),
        basePrice: Number(basePrice) || 0,
        discountPrice: discountPrice ? Number(discountPrice) : null,
        currency: currency.toUpperCase(),
        taxRate: 0,
        startsAt: startsAt ? new Date(startsAt).toISOString() : null,
        endsAt: endsAt ? new Date(endsAt).toISOString() : null,
        isActive: true,
        priority: 50,
      });
      setMessage(
        locale === "ar"
          ? "تم حفظ قاعدة التسعير. بعد انتهاء العرض تُستبعد تلقائيًا ولن تُعاد كتابة السجلات السابقة."
          : "Pricing rule saved. After the offer ends it is excluded automatically; past records are never rewritten.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "SAVE_FAILED");
    }
  };

  return (
    <AdminShell title={locale === "ar" ? "التسعير والعروض" : "Pricing & offers"}>
      <ScrollView contentContainerStyle={styles.page}>
        <Text style={styles.help}>
          {locale === "ar"
            ? "حدّد السعر الأساسي والمخفّض حسب الدولة. عند انتهاء التاريخ يعود السعر السابق تلقائيًا لأن القواعد المنتهية تُستبعد من الحساب."
            : "Set base and discounted prices by country. When dates end, the previous price returns automatically because expired rules are excluded."}
        </Text>

        <Field label={locale === "ar" ? "اسم العرض" : "Offer name"} value={name} onChangeText={setName} />
        <Field
          label={locale === "ar" ? "رمز الدولة" : "Country code"}
          value={countryCode}
          onChangeText={setCountryCode}
          autoCapitalize="characters"
        />
        <Field
          label={locale === "ar" ? "السعر الأساسي (هللة/سنت)" : "Base price (minor units)"}
          value={basePrice}
          onChangeText={setBasePrice}
          keyboardType="number-pad"
        />
        <Field
          label={locale === "ar" ? "السعر بعد الخصم" : "Discount price"}
          value={discountPrice}
          onChangeText={setDiscountPrice}
          keyboardType="number-pad"
        />
        <Field label={locale === "ar" ? "العملة" : "Currency"} value={currency} onChangeText={setCurrency} />
        <Field
          label={locale === "ar" ? "بداية العرض (ISO اختياري)" : "Starts at (optional ISO)"}
          value={startsAt}
          onChangeText={setStartsAt}
          autoCapitalize="none"
        />
        <Field
          label={locale === "ar" ? "نهاية العرض (ISO اختياري)" : "Ends at (optional ISO)"}
          value={endsAt}
          onChangeText={setEndsAt}
          autoCapitalize="none"
        />
        <PrimaryButton
          label={locale === "ar" ? "حفظ قاعدة التسعير" : "Save pricing rule"}
          icon="save"
          onPress={() => void save()}
        />
        {message ? <Text style={styles.message}>{message}</Text> : null}

        <Text style={styles.section}>
          {locale === "ar" ? "القواعد النشطة الآن" : "Active rules now"}
        </Text>
        {rulesQuery.isLoading ? <ActivityIndicator color={BRAND.yellowDark} /> : null}
        {(rulesQuery.data ?? []).map((rule) => (
          <View key={rule.id} style={styles.row}>
            <Text style={styles.rowTitle}>{rule.name}</Text>
            <Text style={styles.rowMeta}>
              {rule.scopeType} · {rule.countryId ?? "—"} · {rule.basePrice}
              {rule.discountPrice != null ? ` → ${rule.discountPrice}` : ""} {rule.currency}
            </Text>
            <Text style={styles.rowMeta}>
              {rule.startsAt ?? "—"} → {rule.endsAt ?? "—"}
            </Text>
          </View>
        ))}
        <Pressable onPress={() => router.push("/admin/settings" as never)}>
          <Text style={styles.link}>
            {locale === "ar" ? "مفاتيح التشغيل (مجاني/مدفوع/...)" : "Launch flags (free/paid/...)"}
          </Text>
        </Pressable>
      </ScrollView>
    </AdminShell>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, paddingBottom: 40, gap: 10 },
  help: { color: BRAND.muted, fontSize: 12, lineHeight: 19, textAlign: "right" },
  section: {
    marginTop: 12,
    color: BRAND.black,
    fontSize: 16,
    fontWeight: "900",
    textAlign: "right",
  },
  row: {
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 16,
    padding: 12,
    backgroundColor: BRAND.white,
    gap: 4,
  },
  rowTitle: { color: BRAND.black, fontWeight: "900", textAlign: "right" },
  rowMeta: { color: BRAND.muted, fontSize: 12, textAlign: "right" },
  message: { color: BRAND.success, fontSize: 12, textAlign: "right", fontWeight: "700" },
  link: {
    color: BRAND.yellowDark,
    fontWeight: "900",
    textAlign: "right",
    textDecorationLine: "underline",
    marginTop: 8,
  },
});
