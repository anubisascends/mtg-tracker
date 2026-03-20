import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import publicClient from '../../api/publicClient';
import { EventResponse } from '../../api/events';

function statusColor(status: string): string {
  switch (status) {
    case 'Upcoming':   return '#f59e0b';
    case 'InProgress': return '#22c55e';
    case 'Completed':  return '#64748b';
    default:           return '#94a3b8';
  }
}

function statusLabel(status: string): string {
  return status === 'InProgress' ? 'In Progress' : status;
}

export default function EventStatusListPage() {
  const [events, setEvents] = useState<EventResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    publicClient.get<EventResponse[]>('/events')
      .then((r) => setEvents(r.data.filter((e) => e.status !== 'Planning')))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={styles.loading}>Loading events...</div>;

  const active = events.filter((e) => e.status === 'Upcoming' || e.status === 'InProgress');
  const completed = events.filter((e) => e.status === 'Completed');

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.title}>MTG Events</h1>
        <p style={styles.subtitle}>Select an event to view its live status</p>
      </div>

      {active.length > 0 && (
        <section>
          <h2 style={styles.sectionHeading}>Active Events</h2>
          <div style={styles.grid}>
            {active.map((ev) => <EventCard key={ev.id} event={ev} />)}
          </div>
        </section>
      )}

      {completed.length > 0 && (
        <section style={{ marginTop: '32px' }}>
          <h2 style={styles.sectionHeading}>Completed Events</h2>
          <div style={styles.grid}>
            {completed.map((ev) => <EventCard key={ev.id} event={ev} />)}
          </div>
        </section>
      )}

      {events.length === 0 && (
        <p style={styles.empty}>No events available.</p>
      )}
    </div>
  );
}

function EventCard({ event }: { event: EventResponse }) {
  const color = statusColor(event.status);
  return (
    <Link to={`/status/${event.id}`} style={styles.card}>
      <div style={styles.cardTop}>
        <h3 style={styles.cardTitle}>{event.name}</h3>
        <span style={{ ...styles.badge, color, borderColor: color }}>{statusLabel(event.status)}</span>
      </div>
      <p style={styles.cardMeta}>{event.format} &bull; {new Date(event.date).toLocaleDateString()}</p>
      {event.runPhase && (
        <p style={styles.phase}>Phase: {event.runPhase === 'DeckBuilding' ? 'Deck Building' : event.runPhase === 'PodAssignment' ? 'Pod Assignment' : event.runPhase}</p>
      )}
      <p style={styles.players}>{event.registeredCount} / {event.maxPlayers} players</p>
    </Link>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: '900px', margin: '0 auto', padding: '40px 24px', fontFamily: 'system-ui, sans-serif' },
  header: { textAlign: 'center', marginBottom: '40px' },
  title: { color: '#a855f7', fontSize: '32px', margin: '0 0 8px 0' },
  subtitle: { color: '#94a3b8', margin: 0 },
  sectionHeading: { color: '#e2e8f0', fontSize: '18px', marginBottom: '16px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' },
  card: { display: 'block', backgroundColor: '#16213e', padding: '20px', borderRadius: '8px', border: '1px solid #334155', textDecoration: 'none' },
  cardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' },
  cardTitle: { color: '#e2e8f0', margin: 0, fontSize: '16px' },
  badge: { fontSize: '11px', border: '1px solid', borderRadius: '999px', padding: '2px 8px', whiteSpace: 'nowrap' },
  cardMeta: { color: '#94a3b8', fontSize: '13px', margin: '0 0 6px 0' },
  phase: { color: '#a855f7', fontSize: '13px', margin: '0 0 6px 0' },
  players: { color: '#64748b', fontSize: '13px', margin: 0 },
  empty: { color: '#94a3b8', textAlign: 'center', marginTop: '60px' },
  loading: { color: '#94a3b8', textAlign: 'center', padding: '60px' },
};
