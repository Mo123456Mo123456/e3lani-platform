import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { ApiError, api, loadIdentity, type ScanResult } from '../lib/api';
import { queueScan } from '../lib/db';
import { isOnline, recordDirectScan, syncNow } from '../lib/sync';
import { C, S } from '../lib/theme';

const uuid = (): string =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });

type Phase = 'ready' | 'working' | 'result';

interface Outcome {
  tone: 'ok' | 'warn' | 'bad' | 'queued';
  title: string;
  detail: string;
  bin: string | null;
}

const REASON_AR: Record<string, string> = {
  OUT_OF_RANGE: 'أنت بعيد عن موقع الحاوية',
  LOW_GPS_ACCURACY: 'دقة الموقع ضعيفة',
  IMPLAUSIBLE_SPEED: 'انتقال غير منطقي بين نقطتين',
  ROUTE_MISMATCH: 'المسح خارج مسار السيارة',
  FUTURE_TIMESTAMP: 'ساعة الجهاز غير مضبوطة',
  STALE_TIMESTAMP: 'وقت المسح قديم جدًا',
  TOKEN_BAD_SIGNATURE: 'هذا الرمز غير صادر عن النظام',
  TOKEN_MALFORMED: 'الرمز غير مقروء',
  TOKEN_REVOKED: 'رمز هذا الملصق مُلغى — أبلغ الإدارة',
  BIN_NOT_FOUND: 'الحاوية غير مسجّلة في النظام',
  BIN_DISABLED: 'الحاوية معطّلة في النظام',
  INVALID_LOCATION: 'تعذّر تحديد موقعك',
};

const TONE: Record<Outcome['tone'], { bg: string; fg: string; icon: string }> = {
  ok: { bg: C.successBg, fg: '#14532D', icon: '✓' },
  warn: { bg: C.warningBg, fg: '#92400E', icon: '!' },
  bad: { bg: C.dangerBg, fg: '#991B1B', icon: '✕' },
  queued: { bg: '#EFF6FF', fg: '#1E40AF', icon: '⇅' },
};

export default function ScanScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<Phase>('ready');
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const lastToken = useRef<{ value: string; at: number } | null>(null);

  const handle = useCallback(
    async (token: string) => {
      // منع المسح المزدوج السريع لنفس الملصق (الكاميرا تُطلق الحدث عدة مرات)
      const now = Date.now();
      if (lastToken.current && lastToken.current.value === token && now - lastToken.current.at < 3000) {
        return;
      }
      lastToken.current = { value: token, at: now };

      setPhase('working');
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // 1) الموقع أولًا — بلا موقع لا يوجد إثبات
      let pos: Location.LocationObject;
      try {
        const perm = await Location.getForegroundPermissionsAsync();
        if (perm.status !== 'granted') {
          const asked = await Location.requestForegroundPermissionsAsync();
          if (asked.status !== 'granted') {
            setOutcome({
              tone: 'bad',
              title: 'إذن الموقع مطلوب',
              detail: 'لا يمكن إثبات الزيارة بدون تحديد الموقع. فعّل الإذن من إعدادات الجهاز.',
              bin: null,
            });
            setPhase('result');
            return;
          }
        }
        pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      } catch {
        setOutcome({
          tone: 'bad',
          title: 'تعذّر تحديد الموقع',
          detail: 'تأكد من تفعيل GPS ثم أعد المحاولة.',
          bin: null,
        });
        setPhase('result');
        return;
      }

      const identity = await loadIdentity();
      const clientUuid = uuid();
      const payload = {
        clientUuid,
        token,
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        accuracyM: pos.coords.accuracy ?? null,
        scannedAt: new Date(pos.timestamp || Date.now()).toISOString(),
      };

      // 2) الحفظ المحلي دائمًا قبل الإرسال — لا تُفقد عملية أبدًا
      await queueScan({
        client_uuid: clientUuid,
        token,
        bin_label: null,
        lat: payload.lat,
        lon: payload.lon,
        accuracy_m: payload.accuracyM,
        scanned_at: payload.scannedAt,
        session_id: null,
      });

      // 3) الإرسال إن وُجد اتصال
      if (!(await isOnline())) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setOutcome({
          tone: 'queued',
          title: 'تم الحفظ في الجهاز',
          detail: 'لا يوجد اتصال الآن. ستُرسل العملية تلقائيًا عند عودة الإنترنت.',
          bin: null,
        });
        setPhase('result');
        return;
      }

      try {
        const res = await api<ScanResult>('/v1/scans', { method: 'POST', body: payload });
        await recordDirectScan(res);
        await syncNow(null); // نحذف النسخة المحلية عبر مسار المزامنة نفسه

        if (res.outcome === 'duplicate') {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          setOutcome({
            tone: 'warn',
            title: 'مسجّلة اليوم مسبقًا',
            detail: 'هذه الحاوية لها زيارة معتمدة اليوم. حُفظت المحاولة في السجل.',
            bin: res.bin?.publicId ?? null,
          });
        } else if (res.status === 'VERIFIED') {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Vibration.vibrate(60);
          setOutcome({
            tone: 'ok',
            title: 'تم إثبات الزيارة',
            detail:
              res.distanceM !== null
                ? `المسافة إلى الحاوية ${Math.round(res.distanceM)} متر`
                : 'تم التسجيل بنجاح',
            bin: res.bin?.publicId ?? null,
          });
        } else {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          const reasons = res.reasons.map((r) => REASON_AR[r] ?? r).join(' · ');
          setOutcome({
            tone: res.status === 'INVALID' ? 'bad' : 'warn',
            title: res.status === 'INVALID' ? 'لم تُقبل العملية' : 'حُفظت للمراجعة',
            detail: reasons || res.message,
            bin: res.bin?.publicId ?? null,
          });
        }
      } catch (err) {
        const e = err as ApiError;
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setOutcome({
          tone: 'queued',
          title: 'تم الحفظ في الجهاز',
          detail: `${e.message} — ستُرسل العملية تلقائيًا لاحقًا.`,
          bin: null,
        });
      }

      void identity;
      setPhase('result');
    },
    [],
  );

  if (!permission) {
    return (
      <View style={[S.screen, S.center]}>
        <ActivityIndicator color={C.primary} size="large" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[S.screen, S.center]}>
        <Text style={{ fontSize: 44, marginBottom: 12 }}>📷</Text>
        <Text style={[S.h2, { textAlign: 'center' }]}>يحتاج التطبيق إذن الكاميرا</Text>
        <Text style={[S.muted, { textAlign: 'center', marginTop: 6, marginBottom: 20 }]}>
          الكاميرا تُستخدم لمسح رمز الحاوية فقط.
        </Text>
        <TouchableOpacity style={[S.btn, { paddingHorizontal: 30 }]} onPress={requestPermission}>
          <Text style={S.btnText}>السماح بالكاميرا</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (phase === 'result' && outcome) {
    const tone = TONE[outcome.tone];
    return (
      <View style={[S.screen, { padding: 20, justifyContent: 'center' }]}>
        <View style={[S.card, { backgroundColor: tone.bg, borderColor: 'transparent', padding: 24 }]}>
          <Text style={{ fontSize: 52, textAlign: 'center', color: tone.fg }}>{tone.icon}</Text>
          <Text
            style={{
              fontSize: 22,
              fontWeight: '800',
              color: tone.fg,
              textAlign: 'center',
              marginTop: 8,
            }}
          >
            {outcome.title}
          </Text>
          {outcome.bin && (
            <Text
              style={{
                fontSize: 17,
                fontWeight: '700',
                color: tone.fg,
                textAlign: 'center',
                marginTop: 8,
                letterSpacing: 1,
              }}
            >
              {outcome.bin}
            </Text>
          )}
          <Text style={{ fontSize: 14.5, color: tone.fg, textAlign: 'center', marginTop: 10, lineHeight: 23 }}>
            {outcome.detail}
          </Text>
        </View>

        <TouchableOpacity
          style={[S.btn, { marginTop: 20 }]}
          onPress={() => {
            setOutcome(null);
            setPhase('ready');
          }}
        >
          <Text style={S.btnText}>مسح حاوية أخرى</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[S.btnGhost, { marginTop: 10 }]} onPress={() => router.back()}>
          <Text style={S.btnGhostText}>رجوع للشاشة الرئيسية</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView
        style={{ flex: 1 }}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={phase === 'working' ? undefined : ({ data }) => void handle(data)}
      />

      {/* إطار التصويب */}
      <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
        <View
          style={{
            width: 240,
            height: 240,
            borderWidth: 3,
            borderColor: phase === 'working' ? C.accent : 'rgba(255,255,255,.85)',
            borderRadius: 24,
          }}
        />
        <Text style={{ color: '#fff', marginTop: 18, fontSize: 15, fontWeight: '600' }}>
          {phase === 'working' ? 'جارٍ تحديد الموقع وإثبات الزيارة…' : 'وجّه الكاميرا نحو ملصق الحاوية'}
        </Text>
        {phase === 'working' && (
          <ActivityIndicator color="#fff" size="large" style={{ marginTop: 14 }} />
        )}
      </View>
    </View>
  );
}
