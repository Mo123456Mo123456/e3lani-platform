import { useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewToken,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '@e3lani/i18n';
import { LogoMark } from '../../src/components/LogoMark';
import { demoFeed } from '../../src/data/demo';
import { colors } from '../../src/theme';

const { height } = Dimensions.get('window');

type Tab = 'forYou' | 'nearby' | 'latest';

export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('forYou');
  const [activeId, setActiveId] = useState(demoFeed[0]?.id);
  const fade = useRef(new Animated.Value(1)).current;

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems[0]?.item as (typeof demoFeed)[number] | undefined;
    if (first) {
      setActiveId(first.id);
      fade.setValue(0);
      Animated.timing(fade, { toValue: 1, duration: 280, useNativeDriver: true }).start();
    }
  }).current;

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.brandRow}>
          <LogoMark size={28} />
          <Text style={styles.brand}>إعلاني</Text>
        </View>
        <View style={styles.tabs}>
          {(
            [
              ['forYou', 'feed.forYou'],
              ['nearby', 'feed.nearby'],
              ['latest', 'feed.latest'],
            ] as const
          ).map(([key, label]) => (
            <Pressable key={key} onPress={() => setTab(key)} style={styles.tabBtn}>
              <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{t('ar', label)}</Text>
              {tab === key ? <View style={styles.tabUnderline} /> : null}
            </Pressable>
          ))}
        </View>
      </View>

      <FlatList
        data={demoFeed}
        keyExtractor={(item) => item.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={height}
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 70 }}
        renderItem={({ item }) => (
          <View style={[styles.slide, { height }]}>
            <View style={[styles.media, { backgroundColor: item.imageTone }]}>
              <View style={styles.mediaGlow} />
              <Text style={styles.mediaHint}>{item.brand}</Text>
            </View>

            <Animated.View style={[styles.overlay, { opacity: fade, paddingBottom: insets.bottom + 88 }]}>
              <View style={styles.brandChip}>
                <View style={styles.avatar} />
                <Text style={styles.brandName}>{item.brand}</Text>
              </View>

              <View style={styles.metaBlock}>
                <Text style={styles.offerTitle}>{item.title}</Text>
                <Text style={styles.city}>{item.city}</Text>
                <Text style={styles.description}>{item.description}</Text>
              </View>

              <View style={styles.actions}>
                <Action label={item.saves} caption="حفظ" />
                <Action label={item.views} caption="مشاهدة" />
                <Action label={item.shares} caption="مشاركة" />
                <Action label="واتساب" caption={t('ar', 'feed.contact')} accent />
              </View>

              <Pressable style={styles.cta}>
                <Text style={styles.ctaText}>{t('ar', 'feed.visitStore')}</Text>
              </Pressable>
            </Animated.View>

            {activeId === item.id ? <View style={styles.activePulse} /> : null}
          </View>
        )}
      />
    </View>
  );
}

function Action({
  label,
  caption,
  accent,
}: {
  label: string;
  caption: string;
  accent?: boolean;
}) {
  return (
    <View style={styles.actionItem}>
      <View style={[styles.actionCircle, accent && styles.actionAccent]}>
        <Text style={styles.actionGlyph}>{accent ? '☎' : '•'}</Text>
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
      <Text style={styles.actionCaption}>{caption}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  header: {
    position: 'absolute',
    zIndex: 20,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
  },
  brandRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  brand: {
    color: colors.white,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  tabs: {
    flexDirection: 'row-reverse',
    gap: 18,
  },
  tabBtn: { alignItems: 'center' },
  tabText: { color: 'rgba(255,255,255,0.55)', fontSize: 15, fontWeight: '600' },
  tabTextActive: { color: colors.white },
  tabUnderline: {
    marginTop: 4,
    height: 3,
    width: 22,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  slide: { width: '100%' },
  media: { ...StyleSheet.absoluteFillObject },
  mediaGlow: {
    position: 'absolute',
    left: -40,
    right: -40,
    top: '30%',
    height: 220,
    backgroundColor: 'rgba(255,196,0,0.12)',
    transform: [{ rotate: '-8deg' }],
  },
  mediaHint: {
    position: 'absolute',
    top: '42%',
    alignSelf: 'center',
    color: 'rgba(255,255,255,0.35)',
    fontSize: 42,
    fontWeight: '800',
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
  },
  brandChip: {
    position: 'absolute',
    top: 120,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
  },
  brandName: { color: colors.white, fontWeight: '700', fontSize: 14 },
  metaBlock: { maxWidth: '72%', marginBottom: 14 },
  offerTitle: { color: colors.white, fontSize: 26, fontWeight: '800', textAlign: 'right' },
  city: { color: colors.primary, marginTop: 4, fontWeight: '700', textAlign: 'right' },
  description: {
    color: 'rgba(255,255,255,0.85)',
    marginTop: 8,
    lineHeight: 22,
    textAlign: 'right',
  },
  actions: {
    position: 'absolute',
    right: 12,
    bottom: 170,
    gap: 14,
    alignItems: 'center',
  },
  actionItem: { alignItems: 'center', gap: 2 },
  actionCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionAccent: { backgroundColor: '#25D366', borderColor: '#25D366' },
  actionGlyph: { color: colors.white, fontSize: 16, fontWeight: '700' },
  actionLabel: { color: colors.white, fontSize: 11, fontWeight: '700' },
  actionCaption: { color: 'rgba(255,255,255,0.65)', fontSize: 10 },
  cta: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  ctaText: { color: colors.black, fontSize: 17, fontWeight: '800' },
  activePulse: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: colors.primary,
  },
});
