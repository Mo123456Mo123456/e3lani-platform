'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';

type Settings = Record<string, unknown>;

export default function SettingsPage() {
  const token = useAuth((s) => s.accessToken)!;
  const [settings, setSettings] = useState<Settings>({});
  const [json, setJson] = useState('{}');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ settings: Settings }>('/admin/settings', token)
      .then((d) => {
        setSettings(d.settings);
        setJson(JSON.stringify(d.settings, null, 2));
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed'));
  }, [token]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    try {
      const body = JSON.parse(json) as Settings;
      const res = await api.patch<{ settings: Settings }>('/admin/settings', token, body);
      setSettings(res.settings);
      setJson(JSON.stringify(res.settings, null, 2));
      setMessage('Settings saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    }
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-fg-muted">In-process system settings (not durable across API restarts)</p>
      </header>
      {error && <p className="text-sm text-danger">{error}</p>}
      {message && <p className="text-sm text-success">{message}</p>}
      <form onSubmit={onSave} className="admin-card space-y-3">
        <textarea
          className="admin-input min-h-[280px] font-mono text-xs"
          value={json}
          onChange={(e) => setJson(e.target.value)}
          spellCheck={false}
        />
        <div className="flex items-center justify-between gap-3">
          <pre className="max-w-md overflow-auto text-xs text-fg-muted">{JSON.stringify(settings)}</pre>
          <button type="submit" className="admin-btn">
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
