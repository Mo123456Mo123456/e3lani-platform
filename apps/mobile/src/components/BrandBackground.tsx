import type { ReactNode } from 'react';
import {
  Image,
  ImageBackground,
  StyleSheet,
  View,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors } from '../theme';

const heroSource = require('../../assets/branding/e3lani-brand-hero.webp');
const headerSource = require('../../assets/branding/e3lani-brand-header.webp');

export type BrandBackgroundVariant = 'full' | 'header' | 'banner' | 'empty';
export type BrandOverlay = 'none' | 'soft' | 'dark' | 'readability';

type Props = {
  variant?: BrandBackgroundVariant;
  overlay?: BrandOverlay;
  height?: number;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
};

/**
 * Official E3lani brand atmosphere background.
 * Use for splash/login heroes, section headers, and empty states — not behind dense lists.
 * Arrow composition stays L→R ascending for brand fidelity in both RTL and LTR UIs.
 */
export function BrandBackground({
  variant = 'header',
  overlay = 'readability',
  height,
  children,
  style,
  imageStyle,
}: Props) {
  const source = variant === 'full' || variant === 'empty' ? heroSource : headerSource;
  const resolvedHeight =
    height ?? (variant === 'full' ? undefined : variant === 'banner' ? 150 : variant === 'empty' ? 240 : 200);

  return (
    <View
      style={[
        styles.wrap,
        variant === 'full' ? styles.full : null,
        resolvedHeight != null ? { height: resolvedHeight } : null,
        style,
      ]}
      pointerEvents="box-none"
    >
      <ImageBackground
        source={source}
        resizeMode="cover"
        style={styles.imageFill}
        imageStyle={[styles.image, imageStyle]}
        accessibilityIgnoresInvertColors
      >
        <OverlayTone tone={overlay} />
        <View style={styles.content} pointerEvents="box-none">
          {children}
        </View>
      </ImageBackground>
    </View>
  );
}

/** Absolute decorative layer for screens that manage their own content layout. */
export function BrandAtmosphere({
  variant = 'header',
  overlay = 'readability',
  height = 220,
  style,
}: Omit<Props, 'children'>) {
  return (
    <View style={[styles.absoluteTop, { height }, style]} pointerEvents="none">
      <BrandBackground variant={variant} overlay={overlay} height={height} />
      <View style={styles.fadeEdge} />
    </View>
  );
}

function OverlayTone({ tone }: { tone: BrandOverlay }) {
  if (tone === 'none') return null;
  if (tone === 'soft') {
    return (
      <>
        <View style={[styles.overlay, { backgroundColor: 'rgba(17,17,17,0.25)' }]} />
        <View style={styles.vignetteTop} />
        <View style={styles.vignetteBottom} />
      </>
    );
  }
  if (tone === 'dark') {
    return <View style={[styles.overlay, { backgroundColor: 'rgba(17,17,17,0.64)' }]} />;
  }
  return (
    <>
      <View style={[styles.overlay, { backgroundColor: 'rgba(17,17,17,0.4)' }]} />
      <View style={styles.vignetteTop} />
      <View style={styles.vignetteBottom} />
    </>
  );
}

export const brandImages = {
  hero: heroSource,
  header: headerSource,
  splash: require('../../assets/branding/splash-brand.png'),
} as const;

export function BrandHeroImage({ style }: { style?: StyleProp<ImageStyle> }) {
  return <Image source={heroSource} resizeMode="cover" style={[{ width: '100%', height: '100%' }, style]} />;
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: colors.black,
  },
  full: {
    ...StyleSheet.absoluteFillObject,
  },
  imageFill: {
    flex: 1,
    width: '100%',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  content: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  vignetteTop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: '30%',
    backgroundColor: 'rgba(17,17,17,0.55)',
  },
  vignetteBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '36%',
    backgroundColor: 'rgba(17,17,17,0.55)',
  },
  absoluteTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 0,
    overflow: 'hidden',
  },
  fadeEdge: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 56,
    backgroundColor: colors.black,
    opacity: 0.85,
  },
});
