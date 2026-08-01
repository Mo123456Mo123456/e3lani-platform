import * as React from 'react';
import {
  Dimensions, FlatList, Pressable, StyleSheet, View, type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import type { MediaDto } from '@e3lani/types';
import { theme } from '@/lib/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PROGRESS_TICK_MS = 220;

export function AdMedia({
  media,
  active,
  height,
  preload = false,
}: {
  media: MediaDto[];
  active: boolean;
  height: number;
  /** الإعلان التالي مباشرة: يُحمَّل مسبقًا وهو خارج الشاشة */
  preload?: boolean;
}) {
  const [index, setIndex] = React.useState(0);
  const [muted, setMuted] = React.useState(true);
  const [controlsVisible, setControlsVisible] = React.useState(true);
  const hideTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const progress = useSharedValue(0);

  const video = media.find((item) => item.type === 'VIDEO');

  const player = useVideoPlayer(video?.url ?? null, (instance) => {
    instance.loop = true;
    instance.muted = true;
    try {
      // مخزن أمامي يكفي لبداية فورية دون استهلاك بيانات زائد
      instance.bufferOptions = { preferredForwardBufferDuration: 6 };
    } catch {
      // بعض المنصات لا تدعم ضبط المخزن — التشغيل الافتراضي يكفي
    }
  });

  React.useEffect(() => {
    if (!video) return;
    player.muted = muted;
    if (active) {
      player.play();
    } else {
      player.pause();
      player.currentTime = 0;
      progress.value = 0;
    }
  }, [active, muted, player, video, progress]);

  // شريط التقدّم: يقرأ موضع التشغيل دوريًا دون إعادة رسم الشجرة كلها
  React.useEffect(() => {
    if (!video || !active) return;
    const timer = setInterval(() => {
      try {
        const duration = player.duration;
        const current = player.currentTime;
        progress.value = duration > 0 ? Math.min(1, Math.max(0, current / duration)) : 0;
      } catch {
        // المشغّل قد يكون تحرّر أثناء الانتقال
      }
    }, PROGRESS_TICK_MS);
    return () => clearInterval(timer);
  }, [active, video, player, progress]);

  const progressStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  const revealControls = React.useCallback(() => {
    setControlsVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setControlsVisible(false), 3000);
  }, []);

  React.useEffect(() => {
    revealControls();
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [revealControls, active]);

  // تجهيز الصور القادمة مسبقًا فتظهر فورًا عند الانتقال
  React.useEffect(() => {
    if (!preload && !active) return;
    const sources = media
      .map((item) => item.thumbnailUrl ?? item.url)
      .filter((url): url is string => Boolean(url));
    if (sources.length) void Image.prefetch(sources, { cachePolicy: 'memory-disk' });
  }, [preload, active, media]);

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    if (next !== index) setIndex(next);
  };

  if (video) {
    return (
      <View style={[styles.container, { height }]}>
        {video.thumbnailUrl ? (
          <Image
            source={{ uri: video.thumbnailUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : null}

        <VideoView
          player={player}
          style={[styles.media, { height }]}
          contentFit="cover"
          nativeControls={false}
          allowsPictureInPicture={false}
        />

        {controlsVisible ? (
          <Pressable
            onPress={() => {
              setMuted((value) => !value);
              revealControls();
            }}
            accessibilityLabel={muted ? 'تشغيل الصوت' : 'كتم الصوت'}
            style={styles.muteButton}
            hitSlop={8}
          >
            <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={18} color="#FFFFFF" />
          </Pressable>
        ) : null}

        {/* شريط تقدّم رفيع يبيّن ما تبقّى من المقطع */}
        <View style={styles.progressTrack} pointerEvents="none">
          <Animated.View style={[styles.progressFill, progressStyle]} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { height }]}>
      <FlatList
        data={media}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={32}
        renderItem={({ item }) => (
          <Image
            source={{ uri: item.url ?? item.thumbnailUrl ?? undefined }}
            placeholder={item.blurhash ? { uri: item.blurhash } : undefined}
            style={{ width: SCREEN_WIDTH, height }}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
          />
        )}
      />

      {media.length > 1 && controlsVisible ? (
        <View style={styles.dots} pointerEvents="none">
          {media.map((item, dotIndex) => (
            <View key={item.id} style={[styles.dot, dotIndex === index ? styles.dotActive : null]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: SCREEN_WIDTH, backgroundColor: '#000000', overflow: 'hidden' },
  media: { width: SCREEN_WIDTH },
  muteButton: {
    position: 'absolute',
    top: 14,
    left: 14,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  progressFill: { height: 3, backgroundColor: theme.colors.primary },
  dots: { position: 'absolute', bottom: 12, alignSelf: 'center', flexDirection: 'row', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.6)' },
  dotActive: { width: 18, backgroundColor: theme.colors.primary },
});
