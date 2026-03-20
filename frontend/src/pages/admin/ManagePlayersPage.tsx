import { useEffect, useState } from 'react';
import { getPlayers, PlayerResponse } from '../../api/players';
import { adminResetPassword } from '../../api/auth';

export default function ManagePlayersPage() {
  const [players, setPlayers] = useState<PlayerResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [resetTarget, setResetTarget] = useState<PlayerResponse | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getPlayers().then(setPlayers).finally(() => setLoading(false));
  }, []);

  const filtered = players.filter(
    (p) => p.username.toLowerCase().includes(search.toLowerCase()) ||
           p.email.toLowerCase().includes(search.toLowerCase())
  );

  const openReset = (p: PlayerResponse) => {
    setResetTarget(p);
    setNewPassword('');
    setResetError('');
    setResetSuccess(false);
  };

  const closeReset = () => {
    setResetTarget(null);
    setNewPassword('');
    setResetError('');
    setResetSuccess(false);
  };

  const handleReset = async () => {
    if (!resetTarget) return;
    setResetError('');
    if (newPassword.length < 6) {
      setResetError('Password must be at least 6 characters.');
      return;
    }
    setSaving(true);
    try {
      await adminResetPassword(resetTarget.id, newPassword);
      setResetSuccess(true);
      setNewPassword('');
    } catch {
      setResetError('Failed to reset password.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={styles.loading}>Loading players...</div>;

  return (
    <div>
      <h1 style={styles.heading}>Players ({players.length})</h1>
      <input
        style={styles.search}
        placeholder="Search by username or email..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Username</th>
            <th style={styles.th}>Email</th>
            <th style={styles.th}>Wins</th>
            <th style={styles.th}>Losses</th>
            <th style={styles.th}>Draws</th>
            <th style={styles.th}>Total</th>
            <th style={styles.th}>Win Rate</th>
            <th style={styles.th}>Member Since</th>
            <th style={styles.th}></th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((p) => {
            const winRate = p.totalMatches > 0
              ? ((p.lifetimeWins / p.totalMatches) * 100).toFixed(1)
              : '0.0';
            return (
              <tr key={p.id}>
                <td style={styles.td}>{p.username}</td>
                <td style={styles.td}>{p.email}</td>
                <td style={{ ...styles.td, color: '#22c55e' }}>{p.lifetimeWins}</td>
                <td style={{ ...styles.td, color: '#ef4444' }}>{p.lifetimeLosses}</td>
                <td style={{ ...styles.td, color: '#f59e0b' }}>{p.lifetimeDraws}</td>
                <td style={styles.td}>{p.totalMatches}</td>
                <td style={{ ...styles.td, color: '#a855f7' }}>{winRate}%</td>
                <td style={styles.td}>{new Date(p.createdAt).toLocaleDateString()}</td>
                <td style={styles.td}>
                  <button style={styles.resetBtn} onClick={() => openReset(p)}>Reset Password</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {resetTarget && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <h2 style={styles.modalTitle}>Reset Password</h2>
            <p style={styles.modalSub}>Set a new password for <strong style={{ color: '#a855f7' }}>{resetTarget.username}</strong></p>
            <input
              type="password"
              style={styles.input}
              placeholder="New password (min 6 chars)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoFocus
            />
            {resetError && <p style={styles.error}>{resetError}</p>}
            {resetSuccess && <p style={styles.success}>Password reset successfully.</p>}
            <div style={styles.modalActions}>
              <button style={styles.cancelBtn} onClick={closeReset}>Close</button>
              <button style={styles.confirmBtn} onClick={handleReset} disabled={saving}>
                {saving ? 'Saving…' : 'Reset'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  loading: { color: '#94a3b8', textAlign: 'center', padding: '40px' },
  heading: { color: '#a855f7', marginBottom: '16px' },
  search: { width: '100%', maxWidth: '400px', padding: '10px', backgroundColor: '#16213e', border: '1px solid #334155', borderRadius: '4px', color: '#e2e8f0', fontSize: '14px', marginBottom: '16px', boxSizing: 'border-box' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', color: '#94a3b8', padding: '10px', borderBottom: '1px solid #334155', fontSize: '13px' },
  td: { color: '#cbd5e1', padding: '10px', borderBottom: '1px solid #1e293b', fontSize: '14px' },
  resetBtn: { background: 'transparent', border: '1px solid #334155', color: '#94a3b8', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', whiteSpace: 'nowrap' },
  overlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 },
  modal: { backgroundColor: '#16213e', border: '1px solid #334155', borderRadius: '8px', padding: '24px', width: '360px', display: 'flex', flexDirection: 'column', gap: '12px' },
  modalTitle: { color: '#e2e8f0', margin: 0 },
  modalSub: { color: '#94a3b8', fontSize: '14px', margin: 0 },
  input: { padding: '10px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '4px', color: '#e2e8f0', fontSize: '14px' },
  error: { color: '#ef4444', fontSize: '13px', margin: 0 },
  success: { color: '#22c55e', fontSize: '13px', margin: 0 },
  modalActions: { display: 'flex', gap: '8px', justifyContent: 'flex-end' },
  cancelBtn: { padding: '8px 16px', background: 'transparent', border: '1px solid #334155', color: '#94a3b8', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' },
  confirmBtn: { padding: '8px 16px', backgroundColor: '#a855f7', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' },
};
