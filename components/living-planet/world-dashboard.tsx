import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { ContributionModal } from "@/components/living-planet/contribution-modal";
import PlanetGlobe from "@/components/living-planet/planet-globe";
import { useI18n } from "@/lib/i18n";
import { useLivingPlanet } from "@/lib/living-planet-store";
import type {
  ContributionCategory,
  WorldEvent,
  WorldEventKind,
} from "@/packages/simulation-models/src";

const categoryItems: {
  id: ContributionCategory;
  icon: keyof typeof MaterialIcons.glyphMap;
  ar: string;
  en: string;
  color: string;
}[] = [
  { id: "creature", icon: "pets", ar: "مخلوق", en: "Creature", color: "#66bfff" },
  { id: "plant", icon: "eco", ar: "نبات", en: "Plant", color: "#5ee28d" },
  { id: "resource", icon: "water-drop", ar: "مورد", en: "Resource", color: "#63b6e9" },
  { id: "civilization", icon: "account-balance", ar: "حضارة", en: "Civilization", color: "#e4b84f" },
  { id: "invention", icon: "settings-suggest", ar: "اختراع", en: "Invention", color: "#57cce8" },
  { id: "phenomenon", icon: "thunderstorm", ar: "ظاهرة", en: "Phenomenon", color: "#a97cff" },
  { id: "disease", icon: "coronavirus", ar: "مرض", en: "Disease", color: "#e3656c" },
  { id: "culture", icon: "groups", ar: "ثقافة", en: "Culture", color: "#c489ff" },
  { id: "custom", icon: "add-box", ar: "مخصص", en: "Custom", color: "#94a8b8" },
];

const eventMeta: Record<
  WorldEventKind,
  { icon: keyof typeof MaterialIcons.glyphMap; color: string }
> = {
  WORLD_CREATED: { icon: "public", color: "#4fcaf0" },
  SPECIES_CREATED: { icon: "cruelty-free", color: "#54d9a2" },
  SPECIES_EXTINCT: { icon: "hide-source", color: "#e76666" },
  CIVILIZATION_FOUNDED: { icon: "account-balance", color: "#d9ab43" },
  TECHNOLOGY_DISCOVERED: { icon: "lightbulb", color: "#5ccded" },
  WAR_STARTED: { icon: "sports-martial-arts", color: "#f2535b" },
  WAR_ENDED: { icon: "handshake", color: "#61d2a5" },
  MIGRATION_STARTED: { icon: "groups", color: "#aa6df3" },
  ALLIANCE_CREATED: { icon: "handshake", color: "#56d8cf" },
  DISEASE_OUTBREAK: { icon: "coronavirus", color: "#de6876" },
  CLIMATE_CHANGED: { icon: "cloud", color: "#7bc9ed" },
  VOLCANO_ERUPTED: { icon: "local-fire-department", color: "#f27b35" },
  RESOURCE_DISCOVERED: { icon: "diamond", color: "#e2b64d" },
  RESOURCE_DEPLETED: { icon: "battery-alert", color: "#e27d4d" },
  TRADE_ROUTE_CREATED: { icon: "route", color: "#6cc5df" },
  CONTRIBUTION_INTRODUCED: { icon: "auto-awesome", color: "#55dfc5" },
  CONTRIBUTION_SPREAD: { icon: "share-location", color: "#78e27f" },
};

type Layer = "surface" | "civilization" | "climate" | "resources" | "movement";

const biomeNames: Record<string, [string, string]> = {
  ocean: ["محيط", "Ocean"],
  coast: ["ساحل", "Coast"],
  plains: ["سهول", "Plains"],
  rainforest: ["غابة مطيرة", "Rainforest"],
  temperate_forest: ["غابة معتدلة", "Temperate forest"],
  desert: ["صحراء", "Desert"],
  mountain: ["جبال", "Mountains"],
  tundra: ["تندرا", "Tundra"],
  wetland: ["أراضٍ رطبة", "Wetland"],
  steppe: ["سهوب", "Steppe"],
  volcanic: ["منطقة بركانية", "Volcanic"],
  ice: ["أراضٍ جليدية", "Ice"],
};

export function WorldDashboard() {
  const { width } = useWindowDimensions();
  const compact = width < 940;
  const {
    ready,
    world,
    displayWorld,
    snapshots,
    isPlaying,
    speed,
    selectedRegion,
    selectedRegionId,
    previewSnapshotId,
    runTick,
    setPlaying,
    setSpeed,
    selectRegion,
    previewSnapshot,
  } = useLivingPlanet();
  const { locale, isRTL, toggleLocale } = useI18n();
  const [modalVisible, setModalVisible] = useState(false);
  const [category, setCategory] = useState<ContributionCategory>("plant");
  const [layer, setLayer] = useState<Layer>("surface");
  const t = (ar: string, en: string) => (locale === "ar" ? ar : en);

  const layerEvents = useMemo(() => {
    const kinds: Partial<Record<Layer, WorldEventKind[]>> = {
      civilization: [
        "CIVILIZATION_FOUNDED",
        "TECHNOLOGY_DISCOVERED",
        "WAR_STARTED",
        "WAR_ENDED",
        "ALLIANCE_CREATED",
      ],
      climate: ["CLIMATE_CHANGED", "VOLCANO_ERUPTED", "DISEASE_OUTBREAK"],
      resources: ["RESOURCE_DISCOVERED", "RESOURCE_DEPLETED", "TRADE_ROUTE_CREATED"],
      movement: ["MIGRATION_STARTED", "CONTRIBUTION_SPREAD"],
    };
    const accepted = kinds[layer];
    return accepted ? displayWorld.events.filter((event) => accepted.includes(event.kind)) : displayWorld.events;
  }, [displayWorld.events, layer]);

  const openContribution = (nextCategory: ContributionCategory) => {
    setCategory(nextCategory);
    setModalVisible(true);
  };

  if (!ready) {
    return (
      <View style={styles.loading}>
        <View style={styles.loadingPlanet}>
          <MaterialIcons name="public" size={42} color="#5ad8f5" />
        </View>
        <ActivityIndicator color="#59dcca" />
        <Text style={styles.loadingText}>{t("جارٍ إعادة بناء العالم من البذرة…", "Rebuilding world from seed…")}</Text>
      </View>
    );
  }

  const dashboard = (
    <>
      <View
        style={[
          styles.main,
          compact
            ? styles.mainCompact
            : { flexDirection: isRTL ? "row-reverse" : "row" },
        ]}
      >
        <ContributionPanel
          compact={compact}
          locale={locale}
          isRTL={isRTL}
          contributions={world.contributions.length}
          events={world.events.filter((event) => event.contributionId).length}
          impactedCivilizations={
            new Set(
              world.contributions.flatMap((item) =>
                item.spreadRegionIds
                  .map((id) => world.regions.find((region) => region.id === id)?.civilizationId)
                  .filter(Boolean),
              ),
            ).size
          }
          onOpen={openContribution}
        />

        <View style={[styles.center, compact && styles.centerCompact]}>
          <View style={[styles.worldStatus, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            <StatusChip
              icon={isPlaying ? "sensors" : "pause-circle"}
              color={isPlaying ? "#54e1b8" : "#8ca4b4"}
              label={isPlaying ? t("المحاكاة تعمل", "Simulation live") : t("المحاكاة متوقفة", "Simulation paused")}
            />
            <StatusChip
              icon="calendar-month"
              color="#4ed0f0"
              label={`${t("السنة", "Year")} ${displayWorld.year.toLocaleString(locale === "ar" ? "ar" : "en")}`}
            />
            <StatusChip
              icon="fingerprint"
              color="#b57cff"
              label={`Seed ${displayWorld.seed}`}
            />
          </View>

          {previewSnapshotId ? (
            <View style={[styles.historyBanner, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
              <MaterialIcons name="history" size={16} color="#f3be5b" />
              <Text style={styles.historyText}>
                {t("أنت تشاهد لقطة تاريخية؛ المحاكاة الحالية لم تتغير.", "Viewing a historical snapshot; current simulation is unchanged.")}
              </Text>
              <Pressable onPress={() => previewSnapshot(null)}>
                <Text style={styles.returnText}>{t("العودة للحاضر", "Return to present")}</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.globeStage}>
            <PlanetGlobe
              seed={displayWorld.seed}
              regions={displayWorld.regions}
              events={layerEvents}
              selectedRegionId={selectedRegionId}
              pollution={displayWorld.metrics.pollution}
              onSelectRegion={selectRegion}
            />
            <View style={[styles.layerLegend, isRTL ? styles.legendRight : styles.legendLeft]}>
              <Text style={styles.legendLabel}>{t("الطبقة النشطة", "Active layer")}</Text>
              <Text style={styles.legendValue}>
                {
                  {
                    surface: t("سطح العالم", "World surface"),
                    civilization: t("الحضارات", "Civilizations"),
                    climate: t("المناخ", "Climate"),
                    resources: t("الموارد", "Resources"),
                    movement: t("الهجرات", "Migration"),
                  }[layer]
                }
              </Text>
            </View>
            <RegionCard locale={locale} isRTL={isRTL} region={selectedRegion} />
          </View>

          <View style={[styles.simulationControls, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isPlaying ? t("إيقاف الزمن", "Pause time") : t("تشغيل الزمن", "Play time")}
              onPress={() => setPlaying(!isPlaying)}
              disabled={Boolean(previewSnapshotId)}
              style={[styles.playButton, previewSnapshotId && styles.disabled]}
            >
              <MaterialIcons name={isPlaying ? "pause" : "play-arrow"} size={22} color="#03161b" />
            </Pressable>
            <Pressable
              onPress={() => runTick(1)}
              disabled={Boolean(previewSnapshotId)}
              style={[styles.tickButton, previewSnapshotId && styles.disabled]}
            >
              <MaterialIcons name="skip-next" size={18} color="#76dcec" />
              <Text style={styles.tickText}>{t("+10 سنوات", "+10 years")}</Text>
            </Pressable>
            <View style={[styles.speedGroup, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
              {([1, 4, 10] as const).map((item) => (
                <Pressable
                  key={item}
                  onPress={() => setSpeed(item)}
                  style={[styles.speedButton, speed === item && styles.speedButtonActive]}
                >
                  <Text style={[styles.speedText, speed === item && styles.speedTextActive]}>{item}×</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.controlHint}>
              {t("اسحب للتدوير • مرّر للتقريب • انقر لاختيار إقليم", "Drag to rotate • scroll to zoom • click a region")}
            </Text>
          </View>
        </View>

        <EventPanel
          compact={compact}
          locale={locale}
          isRTL={isRTL}
          events={displayWorld.events}
          onSelect={selectRegion}
        />
      </View>
      <Timeline
        compact={compact}
        locale={locale}
        isRTL={isRTL}
        events={displayWorld.events}
        snapshots={snapshots}
        activeSnapshotId={previewSnapshotId}
        onPreview={previewSnapshot}
      />
    </>
  );

  return (
    <View style={styles.screen}>
      <Header
        locale={locale}
        isRTL={isRTL}
        compact={compact}
        layer={layer}
        onLayer={setLayer}
        onToggleLocale={toggleLocale}
      />
      {compact ? (
        <ScrollView style={styles.mobileScroll} contentContainerStyle={styles.mobileContent}>
          {dashboard}
        </ScrollView>
      ) : (
        dashboard
      )}
      <ContributionModal
        visible={modalVisible}
        initialCategory={category}
        onClose={() => setModalVisible(false)}
      />
    </View>
  );
}

function Header({
  locale,
  isRTL,
  compact,
  layer,
  onLayer,
  onToggleLocale,
}: {
  locale: "ar" | "en";
  isRTL: boolean;
  compact: boolean;
  layer: Layer;
  onLayer: (layer: Layer) => void;
  onToggleLocale: () => void;
}) {
  const t = (ar: string, en: string) => (locale === "ar" ? ar : en);
  const layers: { id: Layer; ar: string; en: string }[] = [
    { id: "surface", ar: "الرئيسية", en: "World" },
    { id: "civilization", ar: "الحضارات", en: "Civilizations" },
    { id: "climate", ar: "المناخ", en: "Climate" },
    { id: "resources", ar: "الموارد", en: "Resources" },
    { id: "movement", ar: "الهجرات", en: "Migration" },
  ];
  return (
    <View style={[styles.header, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
      <View style={[styles.brand, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <View style={styles.logo}>
          <MaterialIcons name="public" size={27} color="#89e7ff" />
          <View style={styles.logoOrbit} />
        </View>
        <View>
          <Text style={[styles.brandTitle, { textAlign: isRTL ? "right" : "left" }]}>
            {t("كوكب يولد أمامك", "A Planet Born Before You")}
          </Text>
          <Text style={[styles.brandTagline, { textAlign: isRTL ? "right" : "left" }]}>
            {t("عالمك، قرارك، أثر لا ينتهي", "Your world, your choice, a lasting impact")}
          </Text>
        </View>
      </View>
      {!compact ? (
        <View style={[styles.nav, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          {layers.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => onLayer(item.id)}
              style={[styles.navItem, layer === item.id && styles.navItemActive]}
            >
              <Text style={[styles.navText, layer === item.id && styles.navTextActive]}>
                {locale === "ar" ? item.ar : item.en}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <View style={[styles.headerActions, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <View style={styles.livePill}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>{t("حتمي", "Deterministic")}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("تغيير اللغة", "Change language")}
          onPress={onToggleLocale}
          style={styles.iconButton}
        >
          <MaterialIcons name="language" size={19} color="#93a8b8" />
          <Text style={styles.languageText}>{locale === "ar" ? "EN" : "ع"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ContributionPanel({
  compact,
  locale,
  isRTL,
  contributions,
  events,
  impactedCivilizations,
  onOpen,
}: {
  compact: boolean;
  locale: "ar" | "en";
  isRTL: boolean;
  contributions: number;
  events: number;
  impactedCivilizations: number;
  onOpen: (category: ContributionCategory) => void;
}) {
  const t = (ar: string, en: string) => (locale === "ar" ? ar : en);
  return (
    <View style={[styles.sidePanel, compact && styles.compactPanel]}>
      <View style={styles.panelHeader}>
        <Text style={[styles.panelTitle, { textAlign: isRTL ? "right" : "left" }]}>
          {t("أضف عنصرًا واحدًا إلى العالم", "Add one element to the world")}
        </Text>
        <Text style={[styles.panelSubtitle, { textAlign: isRTL ? "right" : "left" }]}>
          {t("اختر فئة، ثم صف فكرتك وحدد موطنها على الكوكب.", "Choose a category, describe it, then select its origin.")}
        </Text>
      </View>
      <Pressable onPress={() => onOpen("plant")} style={styles.addButton}>
        <View style={styles.addHexagon}>
          <MaterialIcons name="add" size={27} color="#9bf4ff" />
        </View>
        <Text style={styles.addText}>{t("ابدأ إضافة جديدة", "Create contribution")}</Text>
      </Pressable>
      <View style={[styles.categoryPanelGrid, compact && styles.categoryPanelGridCompact]}>
        {categoryItems.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => onOpen(item.id)}
            style={styles.categoryPanelItem}
          >
            <MaterialIcons name={item.icon} size={20} color={item.color} />
            <Text style={styles.categoryPanelText}>{locale === "ar" ? item.ar : item.en}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.userImpact}>
        <Text style={[styles.impactTitle, { textAlign: isRTL ? "right" : "left" }]}>
          {t("أثرك على العالم", "Your world impact")}
        </Text>
        <View style={[styles.impactStats, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          <ImpactStat value={contributions} label={t("عناصر", "Items")} icon="auto-awesome" />
          <ImpactStat value={events} label={t("تأثيرات", "Effects")} icon="account-tree" />
          <ImpactStat value={impactedCivilizations} label={t("حضارات", "Civilizations")} icon="account-balance" />
        </View>
      </View>
      <View style={[styles.sandboxNotice, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <MaterialIcons name="science" size={17} color="#58cce3" />
        <Text style={[styles.sandboxText, { textAlign: isRTL ? "right" : "left" }]}>
          {t(
            "التحليل الحالي Sandbox محلي ومعلن. النتائج الأساسية من محرك المحاكاة.",
            "Analysis currently uses a disclosed local Sandbox. Core outcomes come from the simulation engine.",
          )}
        </Text>
      </View>
    </View>
  );
}

function ImpactStat({
  value,
  label,
  icon,
}: {
  value: number;
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
}) {
  return (
    <View style={styles.impactStat}>
      <MaterialIcons name={icon} size={15} color="#58bedb" />
      <Text style={styles.impactValue}>{value.toLocaleString()}</Text>
      <Text style={styles.impactLabel}>{label}</Text>
    </View>
  );
}

function EventPanel({
  compact,
  locale,
  isRTL,
  events,
  onSelect,
}: {
  compact: boolean;
  locale: "ar" | "en";
  isRTL: boolean;
  events: WorldEvent[];
  onSelect: (regionId: string) => void;
}) {
  const t = (ar: string, en: string) => (locale === "ar" ? ar : en);
  return (
    <View style={[styles.sidePanel, styles.eventPanel, compact && styles.compactPanel]}>
      <View style={[styles.eventHeading, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <View style={styles.headingPulse} />
        <Text style={styles.panelTitle}>{t("سجل الأحداث الحي", "Live event log")}</Text>
        <Text style={styles.eventCount}>{events.length}</Text>
      </View>
      <ScrollView
        style={compact ? undefined : styles.eventScroll}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
      >
        {events.slice(0, compact ? 5 : 8).map((event) => {
          const meta = eventMeta[event.kind];
          return (
            <Pressable
              key={event.id}
              onPress={() => onSelect(event.regionId)}
              style={[
                styles.eventItem,
                {
                  borderRightColor: isRTL ? meta.color : "#173448",
                  borderLeftColor: isRTL ? "#173448" : meta.color,
                },
              ]}
            >
              <View style={[styles.eventRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                <View style={[styles.eventIcon, { backgroundColor: `${meta.color}18` }]}>
                  <MaterialIcons name={meta.icon} size={19} color={meta.color} />
                </View>
                <View style={styles.eventCopy}>
                  <View style={[styles.eventTitleRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                    <Text
                      numberOfLines={1}
                      style={[styles.eventTitle, { textAlign: isRTL ? "right" : "left" }]}
                    >
                      {locale === "ar" ? event.titleAr : event.titleEn}
                    </Text>
                    <View style={styles.importance}>
                      {Array.from({ length: event.importance }).map((_, index) => (
                        <View key={index} style={[styles.importanceDot, { backgroundColor: meta.color }]} />
                      ))}
                    </View>
                  </View>
                  <Text
                    numberOfLines={2}
                    style={[styles.eventDescription, { textAlign: isRTL ? "right" : "left" }]}
                  >
                    {locale === "ar" ? event.descriptionAr : event.descriptionEn}
                  </Text>
                  <View style={[styles.eventMeta, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
                    <Text style={styles.eventYear}>{event.year.toLocaleString()} {t("م", "CE")}</Text>
                    <Text style={styles.causeCount}>
                      {event.causeIds.length} {t("أسباب", "causes")} • {Math.round(event.confidence * 100)}%
                    </Text>
                  </View>
                </View>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function RegionCard({
  locale,
  isRTL,
  region,
}: {
  locale: "ar" | "en";
  isRTL: boolean;
  region: ReturnType<typeof useLivingPlanet>["selectedRegion"];
}) {
  const t = (ar: string, en: string) => (locale === "ar" ? ar : en);
  return (
    <View style={[styles.regionCard, isRTL ? styles.regionCardRight : styles.regionCardLeft]}>
      <View style={[styles.regionTitleRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <MaterialIcons name="my-location" size={15} color="#63ddf4" />
        <Text style={styles.regionTitle}>{locale === "ar" ? region.nameAr : region.nameEn}</Text>
      </View>
      <Text style={[styles.biome, { textAlign: isRTL ? "right" : "left" }]}>
        {locale === "ar" ? biomeNames[region.biome]?.[0] : biomeNames[region.biome]?.[1]}
      </Text>
      <View style={[styles.regionStats, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <MiniStat label={t("السكان", "Pop.")} value={compactNumber(region.population)} />
        <MiniStat label={t("الحرارة", "Temp.")} value={`${Math.round(region.temperature * 70 - 25)}°`} />
        <MiniStat label={t("الموارد", "Resources")} value={`${Math.round(region.resourceScore * 100)}%`} />
      </View>
    </View>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.miniStat}>
      <Text style={styles.miniValue}>{value}</Text>
      <Text style={styles.miniLabel}>{label}</Text>
    </View>
  );
}

function StatusChip({
  icon,
  color,
  label,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  color: string;
  label: string;
}) {
  return (
    <View style={styles.statusChip}>
      <MaterialIcons name={icon} size={14} color={color} />
      <Text style={styles.statusText}>{label}</Text>
    </View>
  );
}

function Timeline({
  compact,
  locale,
  isRTL,
  events,
  snapshots,
  activeSnapshotId,
  onPreview,
}: {
  compact: boolean;
  locale: "ar" | "en";
  isRTL: boolean;
  events: WorldEvent[];
  snapshots: ReturnType<typeof useLivingPlanet>["snapshots"];
  activeSnapshotId: string | null;
  onPreview: (id: string | null) => void;
}) {
  const t = (ar: string, en: string) => (locale === "ar" ? ar : en);
  const historical = [...events].sort((a, b) => a.year - b.year).slice(-10);
  return (
    <View style={[styles.timeline, compact && styles.timelineCompact]}>
      <View style={[styles.timelineHeader, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <MaterialIcons name="schedule" size={17} color="#5fcfe8" />
        <Text style={styles.timelineTitle}>{t("خط الزمن", "Timeline")}</Text>
        <Text style={styles.timelineHint}>
          {t("انقر على لقطة للعودة بصريًا دون تغيير الحاضر", "Preview snapshots without changing the present")}
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[
          styles.timelineTrack,
          { flexDirection: isRTL ? "row-reverse" : "row" },
        ]}
      >
        {snapshots.map((snapshot) => (
          <Pressable
            key={snapshot.id}
            onPress={() => onPreview(activeSnapshotId === snapshot.id ? null : snapshot.id)}
            style={[
              styles.snapshot,
              activeSnapshotId === snapshot.id && styles.snapshotActive,
            ]}
          >
            <View style={styles.snapshotDot} />
            <Text style={styles.snapshotYear}>{snapshot.year.toLocaleString()}</Text>
            <Text style={styles.snapshotLabel}>
              {snapshot.tick === 0 ? t("البداية", "Origin") : `${t("Tick", "Tick")} ${snapshot.tick}`}
            </Text>
          </Pressable>
        ))}
        {historical.map((event) => {
          const meta = eventMeta[event.kind];
          return (
            <View key={`timeline-${event.id}`} style={styles.timelineEvent}>
              <MaterialIcons name={meta.icon} size={16} color={meta.color} />
              <Text numberOfLines={1} style={styles.timelineEventTitle}>
                {locale === "ar" ? event.titleAr : event.titleEn}
              </Text>
              <Text style={styles.timelineEventYear}>{event.year.toLocaleString()}</Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

function compactNumber(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return value.toString();
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    minHeight: "100%",
    backgroundColor: "#030a12",
  },
  loading: {
    flex: 1,
    backgroundColor: "#030a12",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },
  loadingPlanet: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: "#0a2332",
    borderWidth: 1,
    borderColor: "#256078",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: { color: "#7f9aaa", fontSize: 12 },
  header: {
    height: 64,
    minHeight: 64,
    paddingHorizontal: 15,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#123145",
    backgroundColor: "#040d16",
    gap: 16,
    zIndex: 5,
  },
  brand: { alignItems: "center", gap: 9, minWidth: 235 },
  logo: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#0a2637",
    borderWidth: 1,
    borderColor: "#2f809b",
    alignItems: "center",
    justifyContent: "center",
  },
  logoOrbit: {
    position: "absolute",
    width: 48,
    height: 18,
    borderWidth: 1,
    borderColor: "#5edcf0",
    borderRadius: 24,
    transform: [{ rotate: "-22deg" }],
    opacity: 0.55,
  },
  brandTitle: { color: "#eef8fd", fontSize: 14, fontWeight: "900" },
  brandTagline: { color: "#637d8f", fontSize: 8, marginTop: 2 },
  nav: { flex: 1, alignSelf: "stretch", alignItems: "center", justifyContent: "center", gap: 6 },
  navItem: {
    height: "100%",
    justifyContent: "center",
    paddingHorizontal: 8,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  navItemActive: { borderBottomColor: "#59d8ef" },
  navText: { color: "#758d9e", fontSize: 10, fontWeight: "700" },
  navTextActive: { color: "#d9f5fb" },
  headerActions: { alignItems: "center", justifyContent: "flex-end", gap: 7, minWidth: 158 },
  livePill: {
    height: 27,
    paddingHorizontal: 8,
    borderRadius: 14,
    backgroundColor: "#09241f",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#4de2ab" },
  liveText: { color: "#73c9af", fontSize: 9, fontWeight: "800" },
  iconButton: {
    height: 31,
    minWidth: 47,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#193548",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  languageText: { color: "#9db0bd", fontSize: 9, fontWeight: "900" },
  main: { flex: 1, minHeight: 0 },
  mainCompact: { flexDirection: "column" },
  mobileScroll: { flex: 1 },
  mobileContent: { flexGrow: 1 },
  sidePanel: {
    width: 255,
    minWidth: 255,
    backgroundColor: "#06111b",
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "#102d3e",
    padding: 12,
    gap: 11,
  },
  compactPanel: {
    width: "100%",
    minWidth: 0,
    borderWidth: 1,
    borderColor: "#102d3e",
  },
  panelHeader: { gap: 4 },
  panelTitle: { color: "#d8e7ee", fontSize: 12, fontWeight: "900" },
  panelSubtitle: { color: "#647e8f", fontSize: 9, lineHeight: 15 },
  addButton: {
    minHeight: 93,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#245c70",
    backgroundColor: "#081e2b",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  addHexagon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#3a92a5",
    backgroundColor: "#0a2935",
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "8deg" }],
  },
  addText: { color: "#91e8f3", fontSize: 10, fontWeight: "800" },
  categoryPanelGrid: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  categoryPanelGridCompact: { justifyContent: "center" },
  categoryPanelItem: {
    width: "31.5%",
    minWidth: 68,
    height: 50,
    backgroundColor: "#0a1823",
    borderWidth: 1,
    borderColor: "#143345",
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  categoryPanelText: { color: "#8196a5", fontSize: 8, fontWeight: "700" },
  userImpact: {
    marginTop: "auto",
    backgroundColor: "#071722",
    borderWidth: 1,
    borderColor: "#143344",
    borderRadius: 12,
    padding: 10,
    gap: 9,
  },
  impactTitle: { color: "#a8bdc9", fontSize: 10, fontWeight: "800" },
  impactStats: { justifyContent: "space-between" },
  impactStat: { flex: 1, alignItems: "center", gap: 2 },
  impactValue: { color: "#eef8fb", fontSize: 13, fontWeight: "900" },
  impactLabel: { color: "#607989", fontSize: 7 },
  sandboxNotice: {
    borderRadius: 10,
    padding: 8,
    gap: 6,
    alignItems: "flex-start",
    backgroundColor: "#071d29",
  },
  sandboxText: { flex: 1, color: "#5c8494", fontSize: 8, lineHeight: 13 },
  center: { flex: 1, minWidth: 0, backgroundColor: "#030b14" },
  centerCompact: { height: 570, minHeight: 570 },
  worldStatus: {
    minHeight: 37,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#0e293a",
  },
  statusChip: {
    height: 24,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: "#071923",
    borderWidth: 1,
    borderColor: "#143448",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  statusText: { color: "#718b9b", fontSize: 8, fontWeight: "700" },
  historyBanner: {
    minHeight: 32,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: "#251d0c",
    borderBottomWidth: 1,
    borderBottomColor: "#5e4820",
  },
  historyText: { color: "#c0a96f", fontSize: 8, flexShrink: 1 },
  returnText: { color: "#f0c96e", fontSize: 8, fontWeight: "900" },
  globeStage: { flex: 1, minHeight: 250, overflow: "hidden" },
  layerLegend: {
    position: "absolute",
    top: 10,
    borderWidth: 1,
    borderColor: "#1b4153",
    borderRadius: 9,
    backgroundColor: "rgba(4, 17, 27, 0.86)",
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  legendRight: { right: 10 },
  legendLeft: { left: 10 },
  legendLabel: { color: "#577486", fontSize: 7 },
  legendValue: { color: "#77d9e9", fontSize: 9, fontWeight: "800", marginTop: 1 },
  regionCard: {
    position: "absolute",
    bottom: 10,
    width: 190,
    borderWidth: 1,
    borderColor: "#205064",
    borderRadius: 12,
    backgroundColor: "rgba(5, 19, 29, 0.9)",
    padding: 10,
    gap: 4,
  },
  regionCardRight: { right: 10 },
  regionCardLeft: { left: 10 },
  regionTitleRow: { alignItems: "center", gap: 5 },
  regionTitle: { color: "#d9edf4", fontSize: 11, fontWeight: "900" },
  biome: { color: "#5cc9b3", fontSize: 8 },
  regionStats: { marginTop: 4 },
  miniStat: { flex: 1, alignItems: "center", gap: 1 },
  miniValue: { color: "#dbeaf0", fontSize: 10, fontWeight: "800" },
  miniLabel: { color: "#587485", fontSize: 7 },
  simulationControls: {
    minHeight: 48,
    paddingHorizontal: 11,
    alignItems: "center",
    gap: 7,
    borderTopWidth: 1,
    borderTopColor: "#102c3d",
    backgroundColor: "#05111a",
  },
  playButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#5ed5df",
    alignItems: "center",
    justifyContent: "center",
  },
  tickButton: {
    height: 31,
    paddingHorizontal: 9,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#1c4558",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  tickText: { color: "#76a7b7", fontSize: 8, fontWeight: "700" },
  disabled: { opacity: 0.35 },
  speedGroup: { borderRadius: 8, overflow: "hidden", borderWidth: 1, borderColor: "#173a4d" },
  speedButton: { width: 31, height: 27, alignItems: "center", justifyContent: "center", backgroundColor: "#071822" },
  speedButtonActive: { backgroundColor: "#123748" },
  speedText: { color: "#567788", fontSize: 8, fontWeight: "800" },
  speedTextActive: { color: "#74d9ea" },
  controlHint: { color: "#405f71", fontSize: 7, flexShrink: 1 },
  eventPanel: { paddingHorizontal: 10 },
  eventHeading: { alignItems: "center", gap: 6, minHeight: 27 },
  headingPulse: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#51d9f0" },
  eventCount: {
    marginStart: "auto",
    color: "#5c7e8f",
    fontSize: 8,
    backgroundColor: "#0b2130",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  eventScroll: { flex: 1 },
  eventItem: {
    borderWidth: 1,
    borderRightWidth: 2,
    borderLeftWidth: 2,
    borderColor: "#173448",
    backgroundColor: "#071722",
    borderRadius: 10,
    padding: 8,
    marginBottom: 7,
  },
  eventRow: { gap: 8, alignItems: "flex-start" },
  eventIcon: {
    width: 31,
    height: 31,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  eventCopy: { flex: 1, minWidth: 0 },
  eventTitleRow: { gap: 5, alignItems: "center" },
  eventTitle: { flex: 1, color: "#cbdde5", fontSize: 10, fontWeight: "800" },
  importance: { flexDirection: "row", gap: 2 },
  importanceDot: { width: 2, height: 2, borderRadius: 1 },
  eventDescription: { color: "#667f90", fontSize: 8, lineHeight: 12, marginTop: 3 },
  eventMeta: { alignItems: "center", justifyContent: "space-between", marginTop: 5 },
  eventYear: { color: "#4f7182", fontSize: 7 },
  causeCount: { color: "#4f7182", fontSize: 7 },
  timeline: {
    height: 105,
    minHeight: 105,
    borderTopWidth: 1,
    borderTopColor: "#143649",
    backgroundColor: "#05101a",
    paddingTop: 7,
  },
  timelineCompact: { height: 112, minHeight: 112 },
  timelineHeader: { alignItems: "center", paddingHorizontal: 14, gap: 6 },
  timelineTitle: { color: "#b9ced8", fontSize: 10, fontWeight: "900" },
  timelineHint: { color: "#4f6d7e", fontSize: 7 },
  timelineTrack: { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 7, gap: 7 },
  snapshot: {
    width: 88,
    height: 50,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#173a4d",
    backgroundColor: "#081823",
    alignItems: "center",
    justifyContent: "center",
  },
  snapshotActive: { borderColor: "#e0af49", backgroundColor: "#211b0f" },
  snapshotDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#59d5e8", marginBottom: 3 },
  snapshotYear: { color: "#b5c9d2", fontSize: 9, fontWeight: "800" },
  snapshotLabel: { color: "#557485", fontSize: 7, marginTop: 2 },
  timelineEvent: {
    width: 120,
    height: 50,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#153447",
    backgroundColor: "#071621",
    paddingHorizontal: 8,
    justifyContent: "center",
  },
  timelineEventTitle: { color: "#94a9b6", fontSize: 8, marginTop: 2 },
  timelineEventYear: { color: "#4f7081", fontSize: 7, marginTop: 2 },
});
