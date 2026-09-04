import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Device from 'expo-device';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import {
  ApiError,
  api,
  getApiUrl,
  saveIdentity,
  setApiUrl,
  setDeviceToken,
  type ActivateResult,
} from '../lib/api';
import { wipeLocal } from '../lib/db';
import { C, S } from '../lib/theme';

/**
 * شاشة التفعيل — تظهر مرة واحدة فقط في عمر الجهاز.
 * بعدها يفتح التطبيق مباشرة على شاشة التشغيل بلا تسجيل دخول.
 */
export default function ActivateScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState<'scan' | 'manual'>('scan');
  const [code, setCode] = useState('');
  const [server, setServer] = useState('');
  const [showServer, setShowServer] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deviceUid = `${Device.osName ?? 'device'}-${
    Device.osBuildId ?? Constants.sessionId ?? Math.random().toString(36).slice(2)
  }`.slice(0, 120);

  const activate = async (raw: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (server.trim()) await setApiUrl(server.trim());
      const base = await getApiUrl();
      if (!base) {
        setShowServer(true);
        throw new ApiError(0, 'NO_API_URL', 'أدخل عنوان خادم الشركة أولًا');
      }

      const res = await api<ActivateResult>('/v1/devices/activate', {
        method: 'POST',
        auth: false,
        body: {
          code: raw,
          deviceUid: deviceUid.length >= 6 ? deviceUid : `vero-${deviceUid}-pad`,
          platform: Device.osName ?? Platform.OS,
          model: Device.modelName ?? 'unknown',
          appVersion: Constants.expoConfig?.version ?? '1.0.0',
        },
      });

      await wipeLocal(); // جهاز جديد = بداية نظيفة
      await setDeviceToken(res.deviceToken);
      await saveIdentity({
        workerId: res.worker.id,
        workerName: res.worker.fullName,
        employeeNo: res.worker.employeeNo,
        vehicleId: res.vehicle.id,
        vehicleNo: res.vehicle.internalNo,
        companyName: res.company.name,
        timezone: res.company.timezone,
      });

      Alert.alert(
        'تم التفعيل',
        `مرحبًا ${res.worker.fullName}\nالسيارة: ${res.vehicle.internalNo}`,
        [{ text: 'ابدأ العمل', onPress: () => router.replace('/') }],
      );
    } catch (err) {
      const e = err as ApiError;
      setError(e.message);
      if (e.code === 'NO_API_URL' || e.isNetwork) setShowServer(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.primary }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 22, justifyContent: 'center' }}>
        <View style={{ alignItems: 'center', marginBottom: 26 }}>
          <Text style={{ color: '#fff', fontSize: 40, fontWeight: '800', letterSpacing: 3 }}>
            VERO
          </Text>
          <Text style={{ color: '#9DC7C2', fontSize: 14, marginTop: 2 }}>كل زيارة لها إثبات</Text>
        </View>

        <View style={[S.card, { padding: 18 }]}>
          <Text style={S.h2}>تفعيل الجهاز</Text>
          <Text style={[S.muted, { marginTop: 6, marginBottom: 14 }]}>
            امسح رمز التفعيل الذي زوّدتك به الإدارة، أو أدخل الكود يدويًا. يتم هذا مرة واحدة فقط.
          </Text>

          <View style={[S.row, { marginBottom: 14 }]}>
            <TouchableOpacity
              style={[
                S.btnGhost,
                { flex: 1, backgroundColor: mode === 'scan' ? C.primary : 'transparent' },
              ]}
              onPress={() => setMode('scan')}
            >
              <Text style={[S.btnGhostText, mode === 'scan' && { color: '#fff' }]}>مسح QR</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                S.btnGhost,
                { flex: 1, backgroundColor: mode === 'manual' ? C.primary : 'transparent' },
              ]}
              onPress={() => setMode('manual')}
            >
              <Text style={[S.btnGhostText, mode === 'manual' && { color: '#fff' }]}>
                إدخال الكود
              </Text>
            </TouchableOpacity>
          </View>

          {error && (
            <View
              style={{
                backgroundColor: C.dangerBg,
                borderRadius: 12,
                padding: 12,
                marginBottom: 14,
              }}
            >
              <Text style={{ color: '#991B1B', textAlign: 'right', fontSize: 13.5 }}>{error}</Text>
            </View>
          )}

          {mode === 'scan' ? (
            <View
              style={{
                height: 280,
                borderRadius: 14,
                overflow: 'hidden',
                backgroundColor: '#000',
                justifyContent: 'center',
              }}
            >
              {!permission ? (
                <ActivityIndicator color="#fff" />
              ) : !permission.granted ? (
                <View style={{ padding: 20 }}>
                  <Text style={{ color: '#fff', textAlign: 'center', marginBottom: 14 }}>
                    يحتاج التطبيق إذن الكاميرا لمسح رمز التفعيل
                  </Text>
                  <TouchableOpacity style={S.btn} onPress={requestPermission}>
                    <Text style={S.btnText}>السماح بالكاميرا</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <CameraView
                  style={{ flex: 1 }}
                  barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                  onBarcodeScanned={busy ? undefined : ({ data }) => void activate(data)}
                />
              )}
            </View>
          ) : (
            <>
              <Text style={[S.muted, { marginBottom: 6 }]}>كود التفعيل</Text>
              <TextInput
                style={[S.input, { textAlign: 'center', fontSize: 22, letterSpacing: 3 }]}
                value={code}
                onChangeText={setCode}
                autoCapitalize="characters"
                autoCorrect={false}
                placeholder="ABCD-2345"
                placeholderTextColor="#9CA3AF"
              />
              <TouchableOpacity
                style={[S.btn, { marginTop: 14 }]}
                onPress={() => void activate(code)}
                disabled={busy || code.trim().length < 6}
              >
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={S.btnText}>تفعيل الجهاز</Text>
                )}
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity
            onPress={() => setShowServer((v) => !v)}
            style={{ marginTop: 16, alignSelf: 'center' }}
          >
            <Text style={{ color: C.muted, fontSize: 12.5 }}>
              {showServer ? 'إخفاء إعدادات الخادم' : 'إعدادات الخادم'}
            </Text>
          </TouchableOpacity>

          {showServer && (
            <View style={{ marginTop: 10 }}>
              <Text style={[S.muted, { marginBottom: 6 }]}>عنوان خادم الشركة</Text>
              <TextInput
                style={[S.input, { textAlign: 'left', fontSize: 14 }]}
                value={server}
                onChangeText={setServer}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                placeholder="https://vero.company.example"
                placeholderTextColor="#9CA3AF"
              />
              <Text style={[S.tiny, { marginTop: 6 }]}>
                يزوّدك به مسؤول النظام في شركتك. يُحفظ في الجهاز مرة واحدة.
              </Text>
            </View>
          )}
        </View>

        <Text style={{ color: '#7FA9A4', fontSize: 11.5, textAlign: 'center', marginTop: 18 }}>
          هذا التطبيق يتصل بخادم شركتك فقط — لا يوجد خادم مركزي.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
