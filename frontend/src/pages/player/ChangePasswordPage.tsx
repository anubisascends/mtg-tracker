import { useState } from 'react';
import { changePassword } from '../../api/auth';

export default function ChangePasswordPage() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (next !== confirm) {
      setError('New passwords do not match.');
      return;
    }
    if (next.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }

    setSaving(true);
    try {
      await changePassword({ currentPassword: current, newPassword: next });
      setSuccess(true);
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch {
      setError('Current password is incorrect.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={s.wrap}>
      <h1 style={s.heading}>Change Password</h1>
      <form onSubmit={handleSubmit} style={s.form}>
        <label style={s.label}>Current Password</label>
        <input
          type="password"
          style={s.input}
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          required
          autoComplete="current-password"
        />

        <label style={s.label}>New Password</label>
        <input
          type="password"
          style={s.input}
          value={next}
          onChange={(e) => setNext(e.target.value)}
          required
          autoComplete="new-password"
        />

        <label style={s.label}>Confirm New Password</label>
        <input
          type="password"
          style={s.input}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          autoComplete="new-password"
        />

        {error && <p style={s.error}>{error}</p>}
        {success && <p style={s.success}>Password changed successfully.</p>}

        <button type="submit" style={s.btn} disabled={saving}>
          {saving ? 'Saving…' : 'Change Password'}
        </button>
      </form>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  wrap: { maxWidth: '400px' },
  heading: { color: '#a855f7', marginBottom: '24px' },
  form: { display: 'flex', flexDirection: 'column', gap: '8px' },
  label: { color: '#94a3b8', fontSize: '13px' },
  input: { padding: '10px', backgroundColor: '#16213e', border: '1px solid #334155', borderRadius: '4px', color: '#e2e8f0', fontSize: '14px' },
  error: { color: '#ef4444', fontSize: '13px', margin: '4px 0 0' },
  success: { color: '#22c55e', fontSize: '13px', margin: '4px 0 0' },
  btn: { marginTop: '8px', padding: '10px', backgroundColor: '#a855f7', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' },
};
