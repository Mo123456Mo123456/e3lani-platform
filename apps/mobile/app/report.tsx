import * as React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { theme } from '@/lib/theme';
import { Button, Field } from '@/components/ui';

export default function ReportScreen() {
  const { adId, postId } = useLocalSearchParams<{ adId?: string; postId?: string }>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [reasons, setReasons] = React.useState<{ key: string; ar: string }[]>([]);
  const [reason, setReason] = React.useState('');
  const [note, setNote] = React.useState('');
  const [status, setStatus] = React.useState<'idle' | 'sent'>('idle');
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    void api<{ key: string; ar: string }[]>('/reports/reasons')
      .then(setReasons)
      .catch(() => undefined);
  }, []);

  const submit = async () => {
    if (!user) {
      router.replace('/login');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api('/reports', {
        method: 'POST',
        auth: true,
        body: JSON.stringify({ adId, postId, reason, note: note || undefined }),
      });
      setStatus('sent');
    } catch (err: any) {
      setError(err?.message ?? 'تعذّر إرسال البلاغ');
    } finally {
      setLoading(false);
    }
  };

  if (status === 'sent') {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 60, alignItems: 'center', gap: 10 }]}>
        <Text style={theme.text.title}>تم استلام بلاغك</Text>
        <Text style={theme.text.caption}>سيراجع فريق الإدارة المحتوى ويتخذ الإجراء المناسب.</Text>
        <Button title="إغلاق" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top + 16 }]}
      contentContainerStyle={{ padding: 18, gap: 14 }}
    >
      <Text style={theme.text.title}>إبلاغ عن محتوى</Text>

      <View style={{ gap: 8 }}>
        {reasons.map((item) => (
          <Pressable
            key={item.key}
            onPress={() => setReason(item.key)}
            style={[styles.option, reason === item.key ? styles.optionActive : null]}
          >
            <Text style={theme.text.body}>{item.ar}</Text>
          </Pressable>
        ))}
      </View>

      <Field
        label="تفاصيل إضافية (اختياري)"
        value={note}
        onChangeText={setNote}
        multiline
        numberOfLines={3}
        style={{ height: 'auto' }}
      />

      {error ? <Text style={{ color: theme.colors.danger }}>{error}</Text> : null}

      <Button title="إرسال البلاغ" onPress={submit} loading={loading} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.white },
  option: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: 12,
  },
  optionActive: { borderColor: theme.colors.primary, backgroundColor: '#FFF6D9' },
});
