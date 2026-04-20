import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { resetPasswordWithToken } from '../api/auth';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setSaving(true);
    try {
      await resetPasswordWithToken(token, password);
      setDone(true);
    } catch {
      setError('This reset link is invalid or has expired.');
    } finally {
      setSaving(false);
    }
  };

  if (!token) return (
    <div style={s.container}>
      <div style={s.card}>
        <h1 style={s.title}>MTG Event Tracker</h1>
        <p style={s.error}>Invalid reset link.</p>
      </div>
    </div>
  );

  if (done) return (
    <div style={s.container}>
      <div style={s.card}>
        <h1 style={s.title}>MTG Event Tracker</h1>
        <p style={s.success}>Password set successfully!</p>
        <button style={s.btn} onClick={() => navigate('/login')}>Go to Login</button>
      </div>
    </div>
  );

  return (
    <div style={s.container}>
      <div style={s.card}>
        <h1 style={s.title}>MTG Event Tracker</h1>
        <h2 style={s.subtitle}>Set Your Password</h2>
        {error && <div style={s.errorBox}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <div style={s.field}>
            <label style={s.label}>New Password</label>
            <input
              style={s.input}
              type="password"
              placeholder="Min 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
          </div>
          <div style={s.field}>
            <label style={s.label}>Confirm Password</label>
            <input
              style={s.input}
              type="password"
              placeholder="Re-enter password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          <button type="submit" style={s.btn} disabled={saving}>
            {saving ? 'Saving…' : 'Set Password'}
          </button>
        </form>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  container: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1a1a2e' },
  card: { backgroundColor: '#16213e', padding: '40px', borderRadius: '8px', width: '100%', maxWidth: '400px', border: '1px solid #a855f7', display: 'flex', flexDirection: 'column', gap: '16px' },
  title: { color: '#a855f7', textAlign: 'center', marginBottom: '0', fontSize: '24px' },
  subtitle: { color: '#e2e8f0', textAlign: 'center', fontWeight: 'normal', fontSize: '18px', margin: '0' },
  field: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { color: '#cbd5e1', fontSize: '14px' },
  input: { padding: '10px', backgroundColor: '#0f3460', border: '1px solid #475569', borderRadius: '4px', color: '#e2e8f0', fontSize: '14px' },
  btn: { width: '100%', padding: '12px', backgroundColor: '#a855f7', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '16px' },
  errorBox: { backgroundColor: '#7f1d1d', color: '#fca5a5', padding: '10px', borderRadius: '4px', fontSize: '14px' },
  error: { color: '#ef4444', textAlign: 'center' },
  success: { color: '#22c55e', textAlign: 'center', fontSize: '15px' },
};
