import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getEvents, EventResponse } from '../../api/events';

export default function EventListPage() {
  const [events, setEvents] = useState<EventResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getEvents().then(setEvents).finally(() => setLoading(false));
  }, []);

  // Players never see Planning events (filtered by backend)
  const active = events.filter((e) => e.status === 'Upcoming' || e.status === 'InProgress');
  const completed = events.filter((e) => e.status === 'Completed');

  if (loading) return <div style={styles.loading}>Loading events...</div>;

  return (
    <div>
      <h1 style={styles.heading}>Events</h1>
      <h2 style={styles.subheading}>Upcoming & In Progress</h2>
      {active.length === 0 && <p style={styles.empty}>No upcoming events.</p>}
      <div style={styles.grid}>
        {active.map((ev) => (
          <EventCard key={ev.id} event={ev} />
        ))}
      </div>
      {completed.length > 0 && (
        <>
          <h2 style={styles.subheading}>Completed</h2>
          <div style={styles.grid}>
            {completed.map((ev) => (
              <EventCard key={ev.id} event={ev} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function fmtTime(t: string): string {
  const [h, m] = t.split(':');
  const hour = parseInt(h);
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
}

function statusColor(status: string): string {
  switch (status) {
    case 'Upcoming':   return '#f59e0b';
    case 'InProgress': return '#22c55e';
    case 'Completed':  return '#64748b';
    default:           return '#94a3b8';
  }
}

function statusLabel(status: string): string {
  if (status === 'InProgress') return 'In Progress';
  return status;
}

function EventCard({ event }: { event: EventResponse }) {
  const color = statusColor(event.status);
  return (
    <Link to={`/events/${event.id}`} style={styles.card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <h3 style={styles.cardTitle}>{event.name}</h3>
        <span style={{ ...styles.badge, color, borderColor: color }}>{statusLabel(event.status)}</span>
      </div>
      <p style={styles.cardMeta}>{event.format} &bull; {new Date(event.date).toLocaleDateString()}{event.startTime ? ` \u2022 ${fmtTime(event.startTime)}${event.endTime ? `\u2013${fmtTime(event.endTime)}` : ''}` : ''}</p>
      <p style={styles.cardDesc}>{event.description}</p>
      <p style={styles.cardPlayers}>{event.registeredCount} / {event.maxPlayers} players</p>
    </Link>
  );
}

const styles: Record<string, React.CSSProperties> = {
  heading: { color: '#a855f7', marginBottom: '8px', fontSize: '22px' },
  subheading: { color: '#e2e8f0', fontSize: '16px', marginBottom: '16px', marginTop: '24px' },
  empty: { color: '#94a3b8' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' },
  card: { display: 'block', backgroundColor: '#16213e', padding: '16px', borderRadius: '8px', border: '1px solid #334155', textDecoration: 'none' },
  cardTitle: { color: '#e2e8f0', margin: '0 0 8px 0', fontSize: '16px' },
  cardMeta: { color: '#94a3b8', fontSize: '13px', margin: '0 0 8px 0' },
  cardDesc: { color: '#cbd5e1', fontSize: '14px', margin: '0 0 12px 0' },
  cardPlayers: { color: '#a855f7', fontSize: '13px', margin: 0 },
  badge: { fontSize: '12px', border: '1px solid', borderRadius: '999px', padding: '2px 8px' },
  loading: { color: '#94a3b8', textAlign: 'center', padding: '40px' },
};
