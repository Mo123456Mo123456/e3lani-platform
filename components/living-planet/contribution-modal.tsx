import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useI18n } from "@/lib/i18n";
import { useLivingPlanet } from "@/lib/living-planet-store";
import {
  analyzeContributionSandbox,
  moderateContributionText,
  projectContributionScenarios,
  type ContributionAnalysis,
  type ContributionCategory,
  type FutureScenario,
} from "@/packages/simulation-models/src";

interface ContributionModalProps {
  visible: boolean;
  initialCategory: ContributionCategory;
  onClose: () => void;
}

const categories: {
  id: ContributionCategory;
  icon: keyof typeof MaterialIcons.glyphMap;
  ar: string;
  en: string;
}[] = [
  { id: "creature", icon: "pets", ar: "مخلوق", en: "Creature" },
  { id: "plant", icon: "eco", ar: "نبات", en: "Plant" },
  { id: "resource", icon: "water-drop", ar: "مورد", en: "Resource" },
  { id: "civilization", icon: "account-balance", ar: "حضارة", en: "Civilization" },
  { id: "invention", icon: "settings-suggest", ar: "اختراع", en: "Invention" },
  { id: "phenomenon", icon: "thunderstorm", ar: "ظاهرة", en: "Phenomenon" },
  { id: "disease", icon: "coronavirus", ar: "مرض", en: "Disease" },
  { id: "culture", icon: "groups", ar: "ثقافة", en: "Culture" },
  { id: "law", icon: "hub", ar: "قانون", en: "World law" },
  { id: "custom", icon: "auto-awesome", ar: "مخصص", en: "Custom" },
];

const traitLabels: Record<string, [string, string]> = {
  growthRate: ["سرعة النمو", "Growth"],
  waterNeed: ["الحاجة للماء", "Water need"],
  pollutionAbsorption: ["امتصاص التلوث", "Pollution absorption"],
  adaptability: ["التكيف", "Adaptability"],
  economicValue: ["القيمة الاقتصادية", "Economic value"],
  aggression: ["العدوانية", "Aggression"],
};

export function ContributionModal({
  visible,
  initialCategory,
  onClose,
}: ContributionModalProps) {
  const { locale, isRTL } = useI18n();
  const { world, selectedRegion, addContribution, runTick } = useLivingPlanet();
  const [category, setCategory] = useState<ContributionCategory>(initialCategory);
  const [sourceText, setSourceText] = useState("");
  const [analysis, setAnalysis] = useState<ContributionAnalysis | null>(null);
  const [scenarios, setScenarios] = useState<FutureScenario[]>([]);
  const [error, setError] = useState("");
  const [step, setStep] = useState<"idea" | "preview" | "future">("idea");

  useEffect(() => {
    if (visible) setCategory(initialCategory);
  }, [initialCategory, visible]);

  const suitable = useMemo(
    () => (analysis ? analysis.possibleBiomes.includes(selectedRegion.biome) : false),
    [analysis, selectedRegion.biome],
  );
  const text = (ar: string, en: string) => (locale === "ar" ? ar : en);

  const close = () => {
    setAnalysis(null);
    setScenarios([]);
    setError("");
    setStep("idea");
    onClose();
  };

  const analyze = () => {
    const moderation = moderateContributionText(sourceText);
    if (!moderation.accepted) {
      setError(locale === "ar" ? moderation.messageAr : moderation.messageEn);
      return;
    }
    try {
      const result = analyzeContributionSandbox(sourceText, category);
      setAnalysis(result);
      setScenarios(projectContributionScenarios(world, result, 100, 64));
      setStep("preview");
      setError("");
    } catch {
      setError(text("تعذر تحويل الفكرة إلى بيانات منظمة.", "Could not create structured data."));
    }
  };

  const confirm = () => {
    if (!analysis) return;
    addContribution({
      sourceText,
      originRegionId: selectedRegion.id,
      analysis,
    });
    runTick(1);
    close();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={styles.modal}>
          <View style={[styles.header, { flexDirection: isRTL ? "row" : "row-reverse" }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={text("إغلاق", "Close")}
              onPress={close}
              style={styles.closeButton}
            >
              <MaterialIcons name="close" size={21} color="#9eb1c1" />
            </Pressable>
            <View style={styles.headerCopy}>
              <Text style={[styles.eyebrow, { textAlign: isRTL ? "right" : "left" }]}>
                {text("مساهمة واحدة • أثر ممتد", "One contribution • lasting impact")}
              </Text>
              <Text style={[styles.title, { textAlign: isRTL ? "right" : "left" }]}>
                {step === "idea"
                  ? text("أضف عنصرًا إلى العالم", "Add an element")
                  : step === "preview"
                    ? text("المعاينة والتوازن", "Preview & balance")
                    : text("ماذا سيحدث؟", "What happens next?")}
              </Text>
            </View>
          </View>

          <View style={[styles.steps, { flexDirection: isRTL ? "row" : "row-reverse" }]}>
            {[
              ["idea", text("الفكرة", "Idea")],
              ["preview", text("التحليل", "Analysis")],
              ["future", text("المستقبل", "Future")],
            ].map(([id, label], index) => (
              <View
                key={id}
                style={[
                  styles.step,
                  (step === id ||
                    (step === "future" && index < 2) ||
                    (step === "preview" && index === 0)) &&
                    styles.stepActive,
                ]}
              >
                <Text style={styles.stepText}>{label}</Text>
              </View>
            ))}
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
          >
            {step === "idea" ? (
              <>
                <Text style={[styles.label, { textAlign: isRTL ? "right" : "left" }]}>
                  {text("اختر الفئة", "Choose category")}
                </Text>
                <View style={[styles.categoryGrid, { flexDirection: isRTL ? "row" : "row-reverse" }]}>
                  {categories.map((item) => (
                    <Pressable
                      key={item.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: category === item.id }}
                      onPress={() => setCategory(item.id)}
                      style={[styles.category, category === item.id && styles.categoryActive]}
                    >
                      <MaterialIcons
                        name={item.icon}
                        size={20}
                        color={category === item.id ? "#64e6d0" : "#7d91a2"}
                      />
                      <Text style={[styles.categoryText, category === item.id && styles.categoryTextActive]}>
                        {locale === "ar" ? item.ar : item.en}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={[styles.label, { textAlign: isRTL ? "right" : "left" }]}>
                  {text("صف فكرتك", "Describe your idea")}
                </Text>
                <TextInput
                  value={sourceText}
                  onChangeText={setSourceText}
                  multiline
                  maxLength={700}
                  textAlign={isRTL ? "right" : "left"}
                  placeholder={text(
                    "مثال: شجرة عملاقة تمتص التلوث وتضيء في الليل، لكنها تحتاج إلى ماء كثير.",
                    "Example: a giant tree that absorbs pollution and glows at night, but needs lots of water.",
                  )}
                  placeholderTextColor="#536779"
                  style={styles.input}
                />
                <View style={[styles.inputMeta, { flexDirection: isRTL ? "row" : "row-reverse" }]}>
                  <Text style={styles.provider}>
                    <MaterialIcons name="science" size={13} />{" "}
                    {text("محلل Sandbox محلي • ليس نموذجًا خارجيًا", "Local Sandbox analyzer • no external model")}
                  </Text>
                  <Text style={styles.counter}>{sourceText.length}/700</Text>
                </View>
              </>
            ) : null}

            {step === "preview" && analysis ? (
              <>
                <View style={styles.analysisCard}>
                  <View style={[styles.analysisTitleRow, { flexDirection: isRTL ? "row" : "row-reverse" }]}>
                    <View style={styles.analysisIcon}>
                      <MaterialIcons name="verified" size={22} color="#56dec9" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.analysisName, { textAlign: isRTL ? "right" : "left" }]}>
                        {analysis.name}
                      </Text>
                      <Text style={[styles.analysisMeta, { textAlign: isRTL ? "right" : "left" }]}>
                        {text("بيانات منظمة ومتحقق منها", "Validated structured data")} •{" "}
                        {Math.round(analysis.confidence * 100)}%
                      </Text>
                    </View>
                  </View>
                  {Object.entries(traitLabels).map(([key, labels]) => {
                    const value = analysis.traits[key as keyof typeof analysis.traits];
                    return (
                      <View key={key} style={styles.trait}>
                        <View style={[styles.traitLabelRow, { flexDirection: isRTL ? "row" : "row-reverse" }]}>
                          <Text style={styles.traitLabel}>{locale === "ar" ? labels[0] : labels[1]}</Text>
                          <Text style={styles.traitValue}>{Math.round(value * 100)}%</Text>
                        </View>
                        <View style={styles.track}>
                          <View style={[styles.fill, { width: `${Math.round(value * 100)}%` }]} />
                        </View>
                      </View>
                    );
                  })}
                </View>
                <View style={styles.columns}>
                  <InfoList
                    title={text("المزايا", "Benefits")}
                    color="#55dfb0"
                    icon="add-circle-outline"
                    items={analysis.benefits}
                    isRTL={isRTL}
                  />
                  <InfoList
                    title={text("المخاطر", "Risks")}
                    color="#f2a54a"
                    icon="warning-amber"
                    items={analysis.risks}
                    isRTL={isRTL}
                  />
                </View>
                {analysis.balanceAdjustments.length > 0 ? (
                  <InfoList
                    title={text("تعديلات التوازن المطبقة", "Applied balance adjustments")}
                    color="#b683ff"
                    icon="tune"
                    items={analysis.balanceAdjustments}
                    isRTL={isRTL}
                  />
                ) : null}
                <View style={[styles.location, { flexDirection: isRTL ? "row" : "row-reverse" }]}>
                  <MaterialIcons
                    name={suitable ? "location-on" : "location-off"}
                    size={24}
                    color={suitable ? "#58e2ca" : "#ef9f48"}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.locationTitle, { textAlign: isRTL ? "right" : "left" }]}>
                      {text("منطقة البداية", "Origin region")}:{" "}
                      {locale === "ar" ? selectedRegion.nameAr : selectedRegion.nameEn}
                    </Text>
                    <Text style={[styles.locationText, { textAlign: isRTL ? "right" : "left" }]}>
                      {suitable
                        ? text("المنطقة ملائمة لهذا العنصر.", "This region is suitable.")
                        : text(
                            "البيئة غير مثالية؛ ستنخفض فرصة الانتشار.",
                            "The habitat is not ideal; spread probability will be lower.",
                          )}
                    </Text>
                  </View>
                </View>
              </>
            ) : null}

            {step === "future" && analysis ? (
              <>
                <View style={styles.monteCarlo}>
                  <MaterialIcons name="account-tree" size={22} color="#58dff5" />
                  <Text style={[styles.monteText, { textAlign: isRTL ? "right" : "left" }]}>
                    {text(
                      "64 مسارًا حتميًا احتماليًا • أفق 100 سنة • النتائج ليست تنبؤًا مؤكدًا",
                      "64 deterministic probabilistic paths • 100-year horizon • results are not certain",
                    )}
                  </Text>
                </View>
                {scenarios.map((scenario) => (
                  <ScenarioCard
                    key={scenario.label}
                    scenario={scenario}
                    locale={locale}
                    isRTL={isRTL}
                  />
                ))}
              </>
            ) : null}

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>

          <View style={[styles.footer, { flexDirection: isRTL ? "row" : "row-reverse" }]}>
            <Pressable onPress={close} style={styles.secondaryButton}>
              <Text style={styles.secondaryText}>{text("إلغاء", "Cancel")}</Text>
            </Pressable>
            {step === "idea" ? (
              <Pressable onPress={analyze} style={styles.primaryButton}>
                <MaterialIcons name="auto-fix-high" size={19} color="#031316" />
                <Text style={styles.primaryText}>{text("حلّل الفكرة", "Analyze idea")}</Text>
              </Pressable>
            ) : null}
            {step === "preview" ? (
              <>
                <Pressable onPress={() => setStep("idea")} style={styles.secondaryButton}>
                  <Text style={styles.secondaryText}>{text("تعديل", "Edit")}</Text>
                </Pressable>
                <Pressable onPress={() => setStep("future")} style={styles.primaryButton}>
                  <MaterialIcons name="insights" size={19} color="#031316" />
                  <Text style={styles.primaryText}>{text("حاكي المستقبل", "Simulate future")}</Text>
                </Pressable>
              </>
            ) : null}
            {step === "future" ? (
              <>
                <Pressable onPress={() => setStep("preview")} style={styles.secondaryButton}>
                  <Text style={styles.secondaryText}>{text("رجوع", "Back")}</Text>
                </Pressable>
                <Pressable onPress={confirm} style={styles.primaryButton}>
                  <MaterialIcons name="public" size={19} color="#031316" />
                  <Text style={styles.primaryText}>{text("أضف إلى العالم", "Add to world")}</Text>
                </Pressable>
              </>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function InfoList({
  title,
  color,
  icon,
  items,
  isRTL,
}: {
  title: string;
  color: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  items: string[];
  isRTL: boolean;
}) {
  return (
    <View style={styles.infoList}>
      <View style={[styles.infoTitleRow, { flexDirection: isRTL ? "row" : "row-reverse" }]}>
        <MaterialIcons name={icon} size={17} color={color} />
        <Text style={[styles.infoTitle, { color }]}>{title}</Text>
      </View>
      {items.map((item) => (
        <Text key={item} style={[styles.infoItem, { textAlign: isRTL ? "right" : "left" }]}>
          • {item}
        </Text>
      ))}
    </View>
  );
}

function ScenarioCard({
  scenario,
  locale,
  isRTL,
}: {
  scenario: FutureScenario;
  locale: "ar" | "en";
  isRTL: boolean;
}) {
  const titles = {
    most_likely: ["السيناريو الأكثر احتمالًا", "Most likely"],
    best_case: ["أفضل مسار", "Best case"],
    worst_case: ["أسوأ مسار", "Worst case"],
  } as const;
  const color =
    scenario.label === "best_case"
      ? "#55dfb0"
      : scenario.label === "worst_case"
        ? "#ef855f"
        : "#55d9f4";
  return (
    <View style={[styles.scenario, { borderColor: `${color}55` }]}>
      <View style={[styles.scenarioHeader, { flexDirection: isRTL ? "row" : "row-reverse" }]}>
        <Text style={[styles.scenarioTitle, { color }]}>
          {locale === "ar" ? titles[scenario.label][0] : titles[scenario.label][1]}
        </Text>
        <Text style={styles.scenarioProbability}>{Math.round(scenario.probability * 100)}%</Text>
      </View>
      <Text style={[styles.scenarioBody, { textAlign: isRTL ? "right" : "left" }]}>
        {locale === "ar"
          ? `انتشار متوقع في ${scenario.spreadRegions} أقاليم • أثر بيئي ${formatSigned(scenario.environmentalImpact)} • أثر اقتصادي ${formatSigned(scenario.economicImpact)}`
          : `Expected spread across ${scenario.spreadRegions} regions • environmental ${formatSigned(scenario.environmentalImpact)} • economic ${formatSigned(scenario.economicImpact)}`}
      </Text>
      <Text style={[styles.factors, { textAlign: isRTL ? "right" : "left" }]}>
        {scenario.factors.join("  •  ")} · {locale === "ar" ? "عدم اليقين" : "uncertainty"}{" "}
        {Math.round(scenario.uncertainty * 100)}%
      </Text>
    </View>
  );
}

function formatSigned(value: number) {
  return `${value >= 0 ? "+" : ""}${Math.round(value * 100)}%`;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 5, 12, 0.82)",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },
  modal: {
    width: "100%",
    maxWidth: 760,
    maxHeight: "94%",
    backgroundColor: "#07121d",
    borderWidth: 1,
    borderColor: "#1c4054",
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#23bde8",
    shadowOpacity: 0.2,
    shadowRadius: 34,
  },
  header: {
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  headerCopy: { flex: 1 },
  eyebrow: { color: "#4ccbe3", fontSize: 11, fontWeight: "700", letterSpacing: 0.6 },
  title: { color: "#eef8ff", fontSize: 22, lineHeight: 30, fontWeight: "900", marginTop: 2 },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#0c1e2c",
    alignItems: "center",
    justifyContent: "center",
  },
  steps: { gap: 6, paddingHorizontal: 20, paddingTop: 14 },
  step: {
    flex: 1,
    height: 3,
    backgroundColor: "#183042",
    borderRadius: 3,
  },
  stepActive: { backgroundColor: "#48cfe6" },
  stepText: { position: "absolute", opacity: 0, fontSize: 1 },
  body: { minHeight: 300, maxHeight: 560 },
  bodyContent: { padding: 20, gap: 13 },
  label: { color: "#d7e5ed", fontSize: 13, fontWeight: "800", marginTop: 3 },
  categoryGrid: { flexWrap: "wrap", gap: 7 },
  category: {
    width: "18.5%",
    minWidth: 92,
    height: 58,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#18374a",
    backgroundColor: "#0a1925",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  categoryActive: { borderColor: "#3dd4c1", backgroundColor: "#0c292d" },
  categoryText: { color: "#879baa", fontSize: 11, fontWeight: "700" },
  categoryTextActive: { color: "#b7fff2" },
  input: {
    minHeight: 122,
    maxHeight: 190,
    backgroundColor: "#05101a",
    borderWidth: 1,
    borderColor: "#1c4256",
    borderRadius: 14,
    color: "#e7f4fa",
    fontSize: 14,
    lineHeight: 23,
    padding: 14,
    textAlignVertical: "top",
  },
  inputMeta: { justifyContent: "space-between", alignItems: "center", gap: 10 },
  provider: { flex: 1, color: "#55b4c8", fontSize: 10 },
  counter: { color: "#60798b", fontSize: 10 },
  analysisCard: {
    borderWidth: 1,
    borderColor: "#1c4054",
    borderRadius: 15,
    backgroundColor: "#081723",
    padding: 15,
    gap: 10,
  },
  analysisTitleRow: { alignItems: "center", gap: 10 },
  analysisIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: "#0b302f",
    alignItems: "center",
    justifyContent: "center",
  },
  analysisName: { color: "#f0fbff", fontSize: 18, fontWeight: "900" },
  analysisMeta: { color: "#7892a3", fontSize: 10, marginTop: 2 },
  trait: { gap: 5 },
  traitLabelRow: { justifyContent: "space-between" },
  traitLabel: { color: "#9bb0bf", fontSize: 11 },
  traitValue: { color: "#5adac8", fontSize: 11, fontWeight: "800" },
  track: { height: 5, borderRadius: 4, backgroundColor: "#142b3b", overflow: "hidden" },
  fill: { height: "100%", backgroundColor: "#4bd5c4", borderRadius: 4 },
  columns: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  infoList: {
    flex: 1,
    minWidth: 230,
    backgroundColor: "#081722",
    borderWidth: 1,
    borderColor: "#183749",
    borderRadius: 13,
    padding: 12,
    gap: 6,
  },
  infoTitleRow: { alignItems: "center", gap: 6 },
  infoTitle: { fontSize: 12, fontWeight: "900" },
  infoItem: { color: "#9eb1be", fontSize: 11, lineHeight: 18 },
  location: {
    gap: 10,
    alignItems: "center",
    backgroundColor: "#0a1a26",
    borderWidth: 1,
    borderColor: "#1a4254",
    borderRadius: 13,
    padding: 12,
  },
  locationTitle: { color: "#d9e8ef", fontSize: 12, fontWeight: "800" },
  locationText: { color: "#7892a3", fontSize: 10, marginTop: 3 },
  monteCarlo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderRadius: 13,
    backgroundColor: "#08202e",
    padding: 12,
  },
  monteText: { flex: 1, color: "#82b7c7", fontSize: 11, lineHeight: 17 },
  scenario: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    backgroundColor: "#081722",
    gap: 7,
  },
  scenarioHeader: { justifyContent: "space-between", alignItems: "center" },
  scenarioTitle: { fontSize: 13, fontWeight: "900" },
  scenarioProbability: { color: "#9db2c0", fontSize: 11 },
  scenarioBody: { color: "#c3d3dc", fontSize: 11, lineHeight: 18 },
  factors: { color: "#637f90", fontSize: 10, lineHeight: 16 },
  error: {
    color: "#ff8b80",
    backgroundColor: "#2a1518",
    borderRadius: 10,
    padding: 10,
    fontSize: 12,
    textAlign: "center",
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: "#142f40",
    padding: 14,
    gap: 8,
    justifyContent: "flex-end",
  },
  primaryButton: {
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: "#55ddcb",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  primaryText: { color: "#031316", fontSize: 12, fontWeight: "900" },
  secondaryButton: {
    minHeight: 44,
    paddingHorizontal: 17,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#244457",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: { color: "#9fb3c0", fontSize: 12, fontWeight: "800" },
});
