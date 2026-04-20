import { useEffect, useState } from 'react';
import { getEmailSettings, updateEmailSettings, testEmailSettings, EmailSettingsDto } from '../../api/settings';

export default function EmailSettingsPage() {
  const [form, setForm] = useState<Omit<EmailSettingsDto, 'isConfigured'>>({
    host: '', port: 587, fromAddress: '', username: '', password: '', enableSsl: true,
  });
  const [isConfigured, setIsConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [testMsg, setTestMsg] = useState('');
  const [testOk, setTestOk] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getEmailSettings()
      .then((s) => {
        setForm({ host: s.host, port: s.port, fromAddress: s.fromAddress, username: s.username, password: s.password, enableSsl: s.enableSsl });
        setIsConfigured(s.isConfigured);
      })
      .finally(() => setLoading(false));
  }, []);

  const set = (field: keyof typeof form, value: string | number | boolean) =>
    setForm((f) => ({ ...f, [field]: value }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveMsg('');
    setError('');
    try {
      const result = await updateEmailSettings(form);
      setIsConfigured(result.isConfigured);
      setForm((f) => ({ ...f, password: result.password }));
      setSaveMsg('Settings saved.');
    } catch {
      setError('Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestMsg('');
    setTestOk(false);
    try {
      const res = await testEmailSettings();
      setTestMsg(res.message);
      setTestOk(true);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setTestMsg(err?.response?.data?.message ?? 'Test failed.');
      setTestOk(false);
    } finally {
      setTesting(false);
    }
  };

  if (loading) return <div style={s.loading}>Loading...</div>;

  return (
    <div style={s.container}>
      <h1 style={s.heading}>Email Settings</h1>
      <p style={s.subheading}>
        Configure SMTP to send player invite emails.
        Status: <span style={{ color: isConfigured ? '#22c55e' : '#ef4444', fontWeight: 'bold' }}>
          {isConfigured ? 'Configured' : 'Not configured'}
        </span>
      </p>

      <form onSubmit={handleSave} style={s.form}>
        <div style={s.row}>
          <div style={{ ...s.field, flex: 3 }}>
            <label style={s.label}>SMTP Host</label>
            <input style={s.input} placeholder="smtp.gmail.com" value={form.host} onChange={(e) => set('host', e.target.value)} />
          </div>
          <div style={{ ...s.field, flex: 1 }}>
            <label style={s.label}>Port</label>
            <input style={s.input} type="number" placeholder="587" value={form.port} onChange={(e) => set('port', parseInt(e.target.value) || 587)} />
          </div>
        </div>

        <div style={s.field}>
          <label style={s.label}>From Address</label>
          <input style={s.input} type="email" placeholder="noreply@yourdomain.com" value={form.fromAddress} onChange={(e) => set('fromAddress', e.target.value)} />
        </div>

        <div style={s.row}>
          <div style={{ ...s.field, flex: 1 }}>
            <label style={s.label}>Username <span style={s.optional}>(if required)</span></label>
            <input style={s.input} placeholder="SMTP username or email" value={form.username} onChange={(e) => set('username', e.target.value)} />
          </div>
          <div style={{ ...s.field, flex: 1 }}>
            <label style={s.label}>Password <span style={s.optional}>(if required)</span></label>
            <input style={s.input} type="password" placeholder={form.password === '••••••••' ? 'Saved — enter to change' : 'SMTP password'} value={form.password} onChange={(e) => set('password', e.target.value)} />
          </div>
        </div>

        <div style={s.checkRow}>
          <label style={s.checkLabel}>
            <input type="checkbox" style={s.checkbox} checked={form.enableSsl} onChange={(e) => set('enableSsl', e.target.checked)} />
            Enable SSL / TLS
          </label>
        </div>

        {error && <p style={s.error}>{error}</p>}
        {saveMsg && <p style={s.success}>{saveMsg}</p>}

        <div style={s.btnRow}>
          <button
            type="button"
            style={{ ...s.testBtn, ...(!isConfigured ? s.btnDisabled : {}) }}
            onClick={handleTest}
            disabled={!isConfigured || testing}
            title={!isConfigured ? 'Save a valid configuration first' : 'Send a test email to your admin address'}
          >
            {testing ? 'Sending…' : 'Send Test Email'}
          </button>
          <button type="submit" style={s.saveBtn} disabled={saving}>
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </div>

        {testMsg && (
          <p style={testOk ? s.success : s.error}>{testMsg}</p>
        )}
      </form>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  loading: { color: '#94a3b8', padding: '40px', textAlign: 'center' },
  container: { maxWidth: '640px' },
  heading: { color: '#a855f7', marginBottom: '4px' },
  subheading: { color: '#94a3b8', fontSize: '14px', marginBottom: '24px' },
  form: { backgroundColor: '#16213e', padding: '24px', borderRadius: '8px', border: '1px solid #334155', display: 'flex', flexDirection: 'column', gap: '16px' },
  row: { display: 'flex', gap: '16px' },
  field: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { color: '#cbd5e1', fontSize: '14px' },
  optional: { color: '#64748b', fontSize: '12px' },
  input: { padding: '10px', backgroundColor: '#0f3460', border: '1px solid #475569', borderRadius: '4px', color: '#e2e8f0', fontSize: '14px', boxSizing: 'border-box', width: '100%' },
  checkRow: { display: 'flex', alignItems: 'center' },
  checkLabel: { display: 'flex', alignItems: 'center', gap: '8px', color: '#cbd5e1', fontSize: '14px', cursor: 'pointer' },
  checkbox: { width: '16px', height: '16px', accentColor: '#a855f7', cursor: 'pointer' },
  btnRow: { display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '4px' },
  testBtn: { padding: '10px 20px', background: 'transparent', border: '1px solid #a855f7', color: '#a855f7', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' },
  saveBtn: { padding: '10px 20px', backgroundColor: '#a855f7', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' },
  btnDisabled: { opacity: 0.4, cursor: 'not-allowed' },
  error: { color: '#ef4444', fontSize: '13px', margin: 0 },
  success: { color: '#22c55e', fontSize: '13px', margin: 0 },
};
