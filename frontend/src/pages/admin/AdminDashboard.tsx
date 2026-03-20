import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getEvents, EventResponse } from '../../api/events';
import { getPlayers, PlayerResponse } from '../../api/players';

export default function AdminDashboard() {
  const [events, setEvents] = useState<EventResponse[]>([]);
  const [players, setPlayers] = useState<PlayerResponse[]>([]);

  useEffect(() => {
    getEvents().then(setEvents);
    getPlayers().then(setPlayers);
  }, []);

  const activeEvents = events.filter((e) => e.status === 'Active').length;
  const upcomingEvents = events.filter((e) => e.status === 'Upcoming').length;

  return (
    <div>
      <h1 style={styles.heading}>Admin Dashboard</h1>

      <div style={styles.statsGrid}>
        <StatCard label="Total Events" value={events.length} color="#a855f7" />
        <StatCard label="Active Events" value={activeEvents} color="#22c55e" />
        <StatCard label="Upcoming Events" value={upcomingEvents} color="#f59e0b" />
        <StatCard label="Registered Players" value={players.length} color="#38bdf8" />
      </div>

      <div style={styles.quickLinks}>
        <h2 style={styles.subheading}>Quick Actions</h2>
        <div style={styles.linkGrid}>
          <Link to="/admin/events/new" style={styles.actionBtn}>Create Event</Link>
          <Link to="/admin/events" style={styles.actionBtn}>Manage Events</Link>
          <Link to="/admin/players" style={styles.actionBtn}>View Players</Link>
        </div>
      </div>

      <h2 style={styles.subheading}>Recent Events</h2>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Name</th>
            <th style={styles.th}>Format</th>
            <th style={styles.th}>Date</th>
            <th style={styles.th}>Status</th>
            <th style={styles.th}>Players</th>
            <th style={styles.th}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {events.slice(0, 5).map((ev) => (
            <tr key={ev.id}>
              <td style={styles.td}>{ev.name}</td>
              <td style={styles.td}>{ev.format}</td>
              <td style={styles.td}>{new Date(ev.date).toLocaleDateString()}</td>
              <td style={styles.td}>{ev.status}</td>
              <td style={styles.td}>{ev.registeredCount}/{ev.maxPlayers}</td>
              <td style={styles.td}>
                <Link to={`/admin/events/${ev.id}/edit`} style={styles.tableLink}>Edit</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={styles.statCard}>
      <div style={{ ...styles.statValue, color }}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  heading: { color: '#a855f7', marginBottom: '24px' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px', marginBottom: '32px' },
  statCard: { backgroundColor: '#16213e', padding: '20px', borderRadius: '8px', textAlign: 'center', border: '1px solid #334155' },
  statValue: { fontSize: '36px', fontWeight: 'bold', marginBottom: '8px' },
  statLabel: { color: '#94a3b8', fontSize: '14px' },
  quickLinks: { marginBottom: '32px' },
  subheading: { color: '#e2e8f0', marginBottom: '16px', fontSize: '18px' },
  linkGrid: { display: 'flex', gap: '12px', flexWrap: 'wrap' },
  actionBtn: { backgroundColor: '#a855f7', color: 'white', padding: '10px 20px', borderRadius: '4px', textDecoration: 'none', fontSize: '14px' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', color: '#94a3b8', padding: '10px', borderBottom: '1px solid #334155', fontSize: '13px' },
  td: { color: '#cbd5e1', padding: '10px', borderBottom: '1px solid #1e293b', fontSize: '14px' },
  tableLink: { color: '#a855f7', textDecoration: 'none', fontSize: '13px' },
};
