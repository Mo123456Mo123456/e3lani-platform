import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useKeepAwake } from 'expo-keep-awake';
import {
  ApiError,
  api,
  clearDevice,
  loadIdentity,
  type DeviceState,
  type Identity,
} from '../lib/api';
import { countedToday, pendingPointCount, pendingScanCount, queuePoint } from '../lib/db';
import { isOnline, startAutoSync, syncNow, type SyncSummary } from '../lib/sync';
import { C, S } from '../lib/theme';

const uuid = (): string =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });

const TRACK_INTERVAL_MS = 60_000;

/** شاشة التشغيل: أربعة أرقام وزر واحد كبير. لا شيء يكتبه العامل. */
export default function HomeScreen() {
  useKeepAwake();
  const router = useRouter();

  const [identity, setIdentity] = useState<Identity | null>(null);
  const [state, setState] = useState<DeviceState | null>(null);
  const [localDone, setLocalDone] = useState(0);
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncNote, setSyncNote] = useState<string | null>(null);

  const sessionRef = useRef<string | null>(null);
  sessionRef.current = sessionId;
  const trackTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    const id = await loadIdentity();
    setIdentity(id);
    setOnline(await isOnline());
    setPending((await pendingScanCount()) + (await pendingPointCount()));

    try {
      const s = await api<DeviceState>('/v1/devices/me');
      setState(s);
      setLocalDone(await countedToday(s.serviceDay));
      if (s.session) {
        setSessionId(s.session.id);
        sessionRef.current = s.session.id;
      }
    } catch (err) {
      const e = err as ApiError;
      if (e.status === 401 || e.code === 'DEVICE_REVOKED') {
        // الإدارة ألغت تفعيل الجهاز → نعيده لشاشة التفعيل بدل إظهار بيانات قديمة
        await clearDevice();
        router.replace('/activate');
        return;
      }
      setError(e.message);
      // بلا اتصال: نعرض ما نعرفه محليًا بوضوح بدل رقم مضلّل
      const today = new Date().toLocaleDateString('en-CA');
      setLocalDone(await countedToday(today));
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  useEffect(() => {
    const stop = startAutoSync(
      () => sessionRef.current,
      (s: SyncSummary) => {
        if (s.accepted > 0 || s.duplicates > 0 || s.pointsSent > 0) {
          setSyncNote(
            `تمت مزامنة ${s.accepted + s.duplicates} عملية` +
              (s.pointsSent > 0 ? ` و${s.pointsSent} نقطة مسار` : ''),
          );
          setTimeout(() => setSyncNote(null), 5000);
          void refresh();
        }
      },
    );
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') void refresh();
    });
    return () => {
      stop();
      sub.remove();
    };
  }, [refresh]);

  // تتبّع خط السير — يعمل داخل جلسة العمل فقط، ويتوقف بإنهائها
  useEffect(() => {
    if (!sessionId) {
      if (trackTimer.current) clearInterval(trackTimer.current);
      trackTimer.current = null;
      return;
    }
    const capture = async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        await queuePoint({
          client_uuid: uuid(),
          session_id: sessionId,
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          speed_mps: pos.coords.speed ?? null,
          accuracy_m: pos.coords.accuracy ?? null,
          recorded_at: new Date(pos.timestamp).toISOString(),
        });
        setPending((await pendingScanCount()) + (await pendingPointCount()));
      } catch {
        /* تعذّر أخذ الموقع هذه المرة — نحاول في الدورة التالية */
      }
    };
    void capture();
    trackTimer.current = setInterval(() => void capture(), TRACK_INTERVAL_MS);
    return () => {
      if (trackTimer.current) clearInterval(trackTimer.current);
      trackTimer.current = null;
    };
  }, [sessionId]);

  const startShift = async () => {
    setBusy(true);
    setError(null);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        setError('يحتاج إثبات الزيارة إذن الموقع. فعّله من إعدادات الجهاز.');
        return;
      }
      const res = await api<{ sessionId: string }>('/v1/routes/sessions', {
        method: 'POST',
        body: {},
      });
      setSessionId(res.sessionId);
      sessionRef.current = res.sessionId;
      await refresh();
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  const endShift = async () => {
    if (!sessionId) return;
    setBusy(true);
    try {
      await syncNow(sessionId);
      await api(`/v1/routes/sessions/${sessionId}/end`, { method: 'POST' });
      setSessionId(null);
      sessionRef.current = null;
      await refresh();
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  const manualSync = async () => {
    setBusy(true);
    const s = await syncNow(sessionRef.current);
    setBusy(false);
    setSyncNote(
      s.ran
        ? `تمت المزامنة: ${s.accepted} جديدة، ${s.duplicates} مسجّلة مسبقًا، ${s.rejected} مرفوضة`
        : 'لا يوجد اتصال بالإنترنت الآن',
    );
    setTimeout(() => setSyncNote(null), 6000);
    await refresh();
  };

  const done = Math.max(state?.doneToday ?? 0, localDone);
  const remaining = state ? Math.max(0, state.totalBins - done) : null;

  return (
    <ScrollView
      style={S.screen}
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={false} onRefresh={() => void refresh()} />}
    >
      {/* ترويسة الهوية */}
      <View style={{ backgroundColor: C.primary, padding: 20, paddingTop: 50 }}>
        <View style={[S.row, { justifyContent: 'space-between' }]}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#9DC7C2', fontSize: 12, textAlign: 'right' }}>
              {identity?.companyName ?? 'VERO'}
            </Text>
            <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700', textAlign: 'right' }}>
              {identity?.workerName ?? '—'}
            </Text>
            <Text style={{ color: '#9DC7C2', fontSize: 13.5, textAlign: 'right' }}>
              السيارة {identity?.vehicleNo ?? '—'}
            </Text>
          </View>
          <View
            style={[
              S.pill,
              { backgroundColor: online ? 'rgba(255,255,255,.16)' : C.warning },
            ]}
          >
            <Text style={[S.pillText, { color: '#fff' }]}>
              {online ? 'متصل' : 'بدون إنترنت'}
            </Text>
          </View>
        </View>
      </View>

      <View style={{ padding: 16, gap: 14 }}>
        {/* العدّادات */}
        <View style={[S.row, { gap: 12 }]}>
          <Counter label="تم اليوم" value={done} color={C.success} />
          <Counter
            label="المتبقي"
            value={remaining === null ? '—' : remaining}
            color={C.warning}
          />
          <Counter label="بانتظار المزامنة" value={pending} color={pending > 0 ? C.danger : C.muted} />
        </View>

        {error && (
          <View style={{ backgroundColor: C.dangerBg, borderRadius: 12, padding: 13 }}>
            <Text style={{ color: '#991B1B', textAlign: 'right', fontSize: 13.5 }}>{error}</Text>
            <Text style={[S.tiny, { color: '#991B1B', marginTop: 4 }]}>
              يمكنك متابعة المسح — كل عملية تُحفظ في الجهاز وتُرسل عند عودة الاتصال.
            </Text>
          </View>
        )}

        {syncNote && (
          <View style={{ backgroundColor: C.successBg, borderRadius: 12, padding: 13 }}>
            <Text style={{ color: '#14532D', textAlign: 'right', fontSize: 13.5 }}>{syncNote}</Text>
          </View>
        )}

        {/* الزر الكبير */}
        <TouchableOpacity
          style={{
            backgroundColor: sessionId ? C.accent : C.primary,
            borderRadius: 22,
            paddingVertical: 34,
            alignItems: 'center',
            opacity: busy ? 0.7 : 1,
          }}
          onPress={() => router.push('/scan')}
          disabled={busy}
          activeOpacity={0.85}
        >
          <Text style={{ fontSize: 46 }}>🔳</Text>
          <Text style={{ color: '#fff', fontSize: 25, fontWeight: '800', marginTop: 6 }}>
            مسح QR
          </Text>
          <Text style={{ color: 'rgba(255,255,255,.85)', fontSize: 13, marginTop: 3 }}>
            وجّه الكاميرا نحو ملصق الحاوية
          </Text>
        </TouchableOpacity>

        {/* جلسة العمل */}
        <View style={S.card}>
          <Text style={S.h2}>جلسة العمل</Text>
          <Text style={[S.muted, { marginTop: 4, marginBottom: 12 }]}>
            {sessionId
              ? 'الجلسة مفتوحة — يُسجَّل خط سير السيارة الآن.'
              : 'ابدأ الجلسة لتسجيل خط السير. لا يتم تتبّعك خارج الجلسة.'}
          </Text>
          {sessionId ? (
            <TouchableOpacity style={S.btnGhost} onPress={() => void endShift()} disabled={busy}>
              {busy ? (
                <ActivityIndicator color={C.text} />
              ) : (
                <Text style={S.btnGhostText}>إنهاء جلسة العمل</Text>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={S.btn} onPress={() => void startShift()} disabled={busy}>
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={S.btnText}>بدء جلسة العمل</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        <View style={[S.row, { gap: 12 }]}>
          <TouchableOpacity
            style={[S.btnGhost, { flex: 1 }]}
            onPress={() => router.push('/history')}
          >
            <Text style={S.btnGhostText}>سجل اليوم</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[S.btnGhost, { flex: 1 }]}
            onPress={() => void manualSync()}
            disabled={busy}
          >
            <Text style={S.btnGhostText}>مزامنة الآن</Text>
          </TouchableOpacity>
        </View>

        <Text style={[S.tiny, { textAlign: 'center', marginTop: 6 }]}>
          VERO — كل زيارة لها إثبات
          {state ? ` · يوم الخدمة ${state.serviceDay}` : ''}
        </Text>
      </View>
    </ScrollView>
  );
}

function Counter({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <View style={[S.card, { flex: 1, alignItems: 'center', paddingVertical: 14 }]}>
      <Text style={{ fontSize: 27, fontWeight: '800', color }}>{value}</Text>
      <Text style={{ fontSize: 11.5, color: C.muted, marginTop: 2, textAlign: 'center' }}>
        {label}
      </Text>
    </View>
  );
}
