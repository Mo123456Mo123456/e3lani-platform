import * as React from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing, runOnJS, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming,
} from 'react-native-reanimated';
import { BRAND, COLORS } from '@e3lani/config';
import { Logo } from './logo';

/** مدة العرض الأدنى حتى لا تومض الشاشة على الأجهزة السريعة. */
const MARK_IN_MS = 520;
const HOLD_MS = 900;
const FADE_OUT_MS = 420;
/** مهلة أمان: لا تبقى شاشة البداية ظاهرة بعدها مهما تعثّر التحضير. */
const MAX_VISIBLE_MS = 5000;

export interface AnimatedSplashProps {
  /** هل انتهى التطبيق من التحضير (تحميل الجلسة والخطوط)؟ */
  isReady: boolean;
  onFinish: () => void;
}

/**
 * شاشة البداية المتحركة.
 *
 * تسلسل العرض: شاشة النظام الصفراء ← هذه الشاشة بنفس الخلفية تمامًا
 * (فلا يرى المستخدم أي وميض أو قفزة) ← ظهور العلامة ثم الاسم ثم الشعار النصي
 * ← تلاشٍ كامل يكشف الموجز.
 *
 * تحترم إعداد «تقليل الحركة» في نظام التشغيل: عندها تظهر ثابتة ثم تختفي.
 */
export function AnimatedSplash({ isReady, onFinish }: AnimatedSplashProps) {
  const [reduceMotion, setReduceMotion] = React.useState(false);
  const [motionChecked, setMotionChecked] = React.useState(false);

  const markScale = useSharedValue(0.72);
  const markOpacity = useSharedValue(0);
  const wordmarkOpacity = useSharedValue(0);
  const wordmarkShift = useSharedValue(12);
  const taglineOpacity = useSharedValue(0);
  const screenOpacity = useSharedValue(1);

  React.useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => setReduceMotion(false))
      .finally(() => setMotionChecked(true));
  }, []);

  // حركة الدخول
  React.useEffect(() => {
    if (!motionChecked) return;

    if (reduceMotion) {
      markOpacity.value = 1;
      markScale.value = 1;
      wordmarkOpacity.value = 1;
      wordmarkShift.value = 0;
      taglineOpacity.value = 1;
      return;
    }

    markOpacity.value = withTiming(1, { duration: 260, easing: Easing.out(Easing.quad) });
    markScale.value = withSequence(
      withTiming(1.06, { duration: MARK_IN_MS, easing: Easing.out(Easing.back(1.6)) }),
      withTiming(1, { duration: 180, easing: Easing.out(Easing.quad) }),
    );
    wordmarkOpacity.value = withDelay(240, withTiming(1, { duration: 340 }));
    wordmarkShift.value = withDelay(
      240,
      withTiming(0, { duration: 380, easing: Easing.out(Easing.cubic) }),
    );
    taglineOpacity.value = withDelay(480, withTiming(1, { duration: 340 }));
  }, [motionChecked, reduceMotion, markOpacity, markScale, wordmarkOpacity, wordmarkShift, taglineOpacity]);

  // شبكة أمان: تختفي الشاشة بعد المهلة القصوى حتى لو لم يبلغ التطبيق جاهزيته،
  // فلا يمكن لأي تعثّر في استعادة الجلسة أن يحبس المستخدم في شاشة ثابتة.
  const [timedOut, setTimedOut] = React.useState(false);
  React.useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), MAX_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, []);

  // الخروج: لا يبدأ قبل جاهزية التطبيق وانقضاء المدة الدنيا
  React.useEffect(() => {
    if ((!isReady && !timedOut) || !motionChecked) return;

    const holdFor = reduceMotion ? 300 : HOLD_MS;
    const timer = setTimeout(() => {
      screenOpacity.value = withTiming(
        0,
        { duration: reduceMotion ? 160 : FADE_OUT_MS, easing: Easing.in(Easing.quad) },
        (finished) => {
          if (finished) runOnJS(onFinish)();
        },
      );
    }, holdFor);

    return () => clearTimeout(timer);
  }, [isReady, timedOut, motionChecked, reduceMotion, screenOpacity, onFinish]);

  const screenStyle = useAnimatedStyle(() => ({ opacity: screenOpacity.value }));
  const markStyle = useAnimatedStyle(() => ({
    opacity: markOpacity.value,
    transform: [{ scale: markScale.value }],
  }));
  const wordmarkStyle = useAnimatedStyle(() => ({
    opacity: wordmarkOpacity.value,
    transform: [{ translateY: wordmarkShift.value }],
  }));
  const taglineStyle = useAnimatedStyle(() => ({ opacity: taglineOpacity.value }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.screen, screenStyle]} pointerEvents="none">
      <View style={styles.content}>
        <Animated.View style={markStyle}>
          <Logo size={104} withWordmark={false} onPrimary />
        </Animated.View>

        <Animated.Text style={[styles.wordmark, wordmarkStyle]}>{BRAND.nameAr}</Animated.Text>

        <Animated.Text style={[styles.tagline, taglineStyle]}>{BRAND.taglineAr}</Animated.Text>
      </View>

      <Text style={styles.footer}>{BRAND.nameEn}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  content: { alignItems: 'center', gap: 14 },
  wordmark: { fontSize: 40, fontWeight: '800', color: COLORS.ink, letterSpacing: -1 },
  tagline: { fontSize: 14, fontWeight: '600', color: COLORS.ink, opacity: 0.72 },
  footer: {
    position: 'absolute',
    bottom: 44,
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.ink,
    opacity: 0.45,
    letterSpacing: 3,
  },
});
