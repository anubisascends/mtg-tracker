import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getPlayer, PlayerResponse } from '../../api/players';
import { getPlayerRegistrations } from '../../api/players';

export default function MyStatsPage() {
  const { user } = useAuth();
  const [player, setPlayer] = useState<PlayerResponse | null>(null);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getPlayer(user.userId),
      getPlayerRegistrations(user.userId),
    ]).then(([p, regs]) => {
      setPlayer(p);
      setRegistrations(regs);
    }).finally(() => setLoading(false));
  }, [user]);

  if (loading) return <div style={styles.loading}>Loading stats...</div>;
  if (!player) return <div style={styles.loading}>Player not found.</div>;

  const winRate = player.totalMatches > 0
    ? ((player.lifetimeWins / player.totalMatches) * 100).toFixed(1)
    : '0.0';

  return (
    <div>
      <h1 style={styles.heading}>My Stats</h1>
      <p style={styles.username}>{player.username}</p>

      <div style={styles.statsGrid}>
        <StatCard label="Wins" value={player.lifetimeWins} color="#22c55e" />
        <StatCard label="Losses" value={player.lifetimeLosses} color="#ef4444" />
        <StatCard label="Draws" value={player.lifetimeDraws} color="#f59e0b" />
        <StatCard label="Total Matches" value={player.totalMatches} color="#a855f7" />
        <StatCard label="Win Rate" value={`${winRate}%`} color="#38bdf8" />
      </div>

      <h2 style={styles.subheading}>My Event Registrations</h2>
      {registrations.length === 0 ? (
        <p style={styles.empty}>Not registered for any events yet.</p>
      ) : (
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Event ID</th>
              <th style={styles.th}>Registered On</th>
            </tr>
          </thead>
          <tbody>
            {registrations.map((r: any) => (
              <tr key={r.id}>
                <td style={styles.td}>{r.eventId}</td>
                <td style={styles.td}>{new Date(r.registeredAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div style={styles.statCard}>
      <div style={{ ...styles.statValue, color }}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  loading: { color: '#94a3b8', textAlign: 'center', padding: '40px' },
  heading: { color: '#a855f7', marginBottom: '4px' },
  username: { color: '#94a3b8', marginBottom: '24px' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '16px', marginBottom: '32px' },
  statCard: { backgroundColor: '#16213e', padding: '20px', borderRadius: '8px', textAlign: 'center', border: '1px solid #334155' },
  statValue: { fontSize: '36px', fontWeight: 'bold', marginBottom: '8px' },
  statLabel: { color: '#94a3b8', fontSize: '14px' },
  subheading: { color: '#e2e8f0', marginBottom: '16px' },
  empty: { color: '#94a3b8' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', color: '#94a3b8', padding: '10px', borderBottom: '1px solid #334155', fontSize: '13px' },
  td: { color: '#cbd5e1', padding: '10px', borderBottom: '1px solid #1e293b', fontSize: '14px' },
};
