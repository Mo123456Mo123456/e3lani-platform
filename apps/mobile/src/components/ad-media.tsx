import * as React from 'react';
import {
  Dimensions, FlatList, Pressable, StyleSheet, View, type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import type { MediaDto } from '@e3lani/types';
import { theme } from '@/lib/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * عرض وسائط الإعلان داخل التطبيق:
 *  • تشغيل تلقائي بدون صوت عند ظهور الإعلان، وإيقاف فوري عند الانتقال.
 *  • زر تشغيل/إيقاف الصوت.
 *  • تحميل تدريجي مع Placeholder.
 *  • سحب أفقي للصور المتعددة مع مؤشر نقاط.
 *  • إخفاء عناصر التحكم بعد ثوانٍ.
 *  • يملأ المساحة دون تشويه ويدعم العمودي والمربع والأفقي.
 */
export function AdMedia({
  media,
  active,
  height,
}: {
  media: MediaDto[];
  active: boolean;
  height: number;
}) {
  const [index, setIndex] = React.useState(0);
  const [muted, setMuted] = React.useState(true);
  const [controlsVisible, setControlsVisible] = React.useState(true);
  const hideTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const video = media.find((item) => item.type === 'VIDEO');

  const player = useVideoPlayer(video?.url ?? null, (instance) => {
    instance.loop = true;
    instance.muted = true;
  });

  React.useEffect(() => {
    if (!video) return;
    player.muted = muted;
    if (active) {
      player.play();
    } else {
      player.pause();
      player.currentTime = 0;
    }
  }, [active, muted, player, video]);

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

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    if (next !== index) setIndex(next);
  };

  if (video) {
    return (
      <Pressable style={[styles.container, { height }]} onPress={revealControls}>
        {video.thumbnailUrl ? (
          <Image
            source={{ uri: video.thumbnailUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
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
          >
            <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={18} color="#FFFFFF" />
          </Pressable>
        ) : null}
      </Pressable>
    );
  }

  return (
    <Pressable style={[styles.container, { height }]} onPress={revealControls}>
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
        <View style={styles.dots}>
          {media.map((item, dotIndex) => (
            <View
              key={item.id}
              style={[
                styles.dot,
                dotIndex === index ? styles.dotActive : null,
              ]}
            />
          ))}
        </View>
      ) : null}
    </Pressable>
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
  dots: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.6)' },
  dotActive: { width: 18, backgroundColor: theme.colors.primary },
});
