import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getEvent, EventResponse } from '../../api/events';
import { getEventRegistrations, registerForEvent, cancelRegistration, selfDrop, selfUndrop, RegistrationResponse } from '../../api/registrations';
import { getEventMatches, recordMatchResult, MatchResponse } from '../../api/matches';
import { useAuth } from '../../context/AuthContext';
import { useIsMobile } from '../../hooks/useIsMobile';

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [event, setEvent] = useState<EventResponse | null>(null);
  const [registrations, setRegistrations] = useState<RegistrationResponse[]>([]);
  const [matches, setMatches] = useState<MatchResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const eventId = parseInt(id!);

  const load = () =>
    Promise.all([
      getEvent(eventId),
      getEventRegistrations(eventId),
      getEventMatches(eventId),
    ]).then(([ev, regs, ms]) => {
      setEvent(ev);
      setRegistrations(regs);
      setMatches(ms);
    }).finally(() => setLoading(false));

  useEffect(() => { load(); }, [eventId]);

  const myRegistration = registrations.find((r) => r.playerId === user?.userId);

  // Find my pending match for the current round
  const myActiveMatch = event?.status === 'InProgress'
    ? matches.find(
        (m) => m.isPending && !m.isBye && m.round === event.currentRound &&
          (m.player1Id === user?.userId || m.player2Id === user?.userId)
      )
    : undefined;

  const handleRegister = async () => {
    try {
      const reg = await registerForEvent(eventId);
      setRegistrations([...registrations, reg]);
      setMessage('Registered successfully!');
    } catch {
      setMessage('Could not register. Event may be full or already registered.');
    }
  };

  const handleCancel = async () => {
    if (!myRegistration) return;
    try {
      await cancelRegistration(myRegistration.id);
      setRegistrations(registrations.filter((r) => r.id !== myRegistration.id));
      setMessage('Registration cancelled.');
    } catch {
      setMessage('Could not cancel registration.');
    }
  };

  const handleSelfDrop = async () => {
    if (!confirm('Drop from this event? You will not be paired in future rounds.')) return;
    try {
      const updated = await selfDrop(eventId);
      setRegistrations(registrations.map((r) => r.id === updated.id ? updated : r));
      setMessage('You have dropped from the event.');
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setMessage(err?.response?.data?.message ?? 'Could not drop from event.');
    }
  };

  const handleSelfUndrop = async () => {
    try {
      const updated = await selfUndrop(eventId);
      setRegistrations(registrations.map((r) => r.id === updated.id ? updated : r));
      setMessage('You have rejoined the event.');
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setMessage(err?.response?.data?.message ?? 'Could not undrop.');
    }
  };

  if (loading) return <div style={s.loading}>Loading...</div>;
  if (!event) return <div style={s.loading}>Event not found.</div>;

  const canRegister = event.status === 'Upcoming' && !myRegistration && event.registeredCount < event.maxPlayers;

  return (
    <div>
      {/* Header */}
      <div style={{ ...s.header, flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'flex-start' }}>
        <div>
          <h1 style={s.title}>{event.name}</h1>
          <p style={s.meta}>{event.format} &bull; {new Date(event.date).toLocaleDateString()}{event.startTime ? ` \u2022 ${fmtTime(event.startTime)}${event.endTime ? `\u2013${fmtTime(event.endTime)}` : ''}` : ''} &bull; <StatusBadge status={event.status} /></p>
          {event.description && <p style={s.desc}>{event.description}</p>}
        </div>
        <div style={{ ...s.actions, alignItems: isMobile ? 'flex-start' : 'flex-end', marginTop: isMobile ? '12px' : 0 }}>
          <p style={s.playerCount}>{registrations.length} / {event.maxPlayers} players</p>
          {event.requiresDeckRegistration && canRegister && (
            <div style={event.proxiesAllowed ? s.proxyNoticeAllowed : s.proxyNoticeBanned}>
              {event.proxiesAllowed
                ? 'Proxies allowed — deck registration required for this event.'
                : 'No proxies — deck registration required for this event.'}
            </div>
          )}
          {canRegister && <button onClick={handleRegister} style={s.btnPrimary}>Register</button>}
          {myRegistration && event.status === 'Upcoming' && (
            <button onClick={handleCancel} style={s.btnDanger}>Cancel Registration</button>
          )}
          {myRegistration && event.requiresDeckRegistration && (
            <button onClick={() => navigate(`/events/${eventId}/deck`)} style={s.btnDeck}>
              {event.status === 'Upcoming' ? 'Submit Deck' : 'View / Edit Deck'}
            </button>
          )}
          {myRegistration && event.status === 'InProgress' && !myRegistration.isEliminated && !myRegistration.isDropped && (
            <button onClick={handleSelfDrop} style={s.btnDanger}>Drop from Event</button>
          )}
          {myRegistration?.isDropped && myRegistration.droppedAtRound >= event.currentRound && (
            <button onClick={handleSelfUndrop} style={s.btnWarning}>Undrop</button>
          )}
          {myRegistration && <span style={s.registeredBadge}>Registered</span>}
        </div>
      </div>

      {message && <div style={s.msg}>{message}</div>}

      {/* Active match card — shown when player has a pending match this round */}
      {myActiveMatch && (
        <ActiveMatchCard
          match={myActiveMatch}
          myUserId={user!.userId}
          onSubmitted={() => { setMessage('Result submitted!'); load(); }}
        />
      )}

      {/* My registration eliminated/dropped notices */}
      {myRegistration?.isEliminated && (
        <div style={s.eliminatedNotice}>
          You have been eliminated from this event.
        </div>
      )}
      {myRegistration?.isDropped && myRegistration.droppedAtRound < event.currentRound && (
        <div style={s.droppedNotice}>
          You have dropped from this event. This drop is permanent.
        </div>
      )}
      {myRegistration?.isDropped && myRegistration.droppedAtRound >= event.currentRound && (
        <div style={s.droppedNoticeTemp}>
          You have dropped from this event. You can still undrop before the next round is paired.
        </div>
      )}

      {/* Two-column info grid */}
      <div style={{ ...s.grid, gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr' }}>
        <section>
          <h2 style={s.sectionTitle}>Players ({registrations.length})</h2>
          {registrations.length === 0 ? (
            <p style={s.empty}>No players registered yet.</p>
          ) : (
            <ul style={s.list}>
              {registrations.map((r) => (
                <li key={r.id} style={{ ...s.listItem, opacity: r.isEliminated || r.isDropped ? 0.5 : 1 }}>
                  {r.playerDisplayName}
                  {r.isEliminated && <span style={s.outBadge}>OUT</span>}
                  {r.isDropped && <span style={s.droppedBadge}>DROPPED</span>}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 style={s.sectionTitle}>
            {event.currentRound > 0 ? `Round ${event.currentRound} Matches` : 'Matches'}
          </h2>
          {matches.length === 0 ? (
            <p style={s.empty}>No matches yet.</p>
          ) : (
            <ul style={s.list}>
              {matches.filter((m) => m.round === event.currentRound || event.currentRound === 0).map((m) => (
                <li key={m.id} style={s.matchItem}>
                  {m.isBye ? (
                    <span style={s.byeRow}>
                      <span>{m.player1DisplayName}</span>
                      <span style={s.byeBadge}>BYE</span>
                    </span>
                  ) : (
                    <>
                      <span style={m.player1Wins > m.player2Wins && !m.isPending ? s.winner : undefined}>
                        {m.player1DisplayName}
                      </span>
                      <span style={s.vs}>vs</span>
                      <span style={m.player2Wins > m.player1Wins && !m.isPending ? s.winner : undefined}>
                        {m.player2DisplayName}
                      </span>
                    </>
                  )}
                  <span style={s.matchResult}>
                    {m.isPending ? 'Pending' : m.isBye ? 'BYE' : `${m.player1Wins}–${m.player2Wins}${m.draws > 0 ? `–${m.draws}` : ''}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

// ── Active match submission card ───────────────────────────────────────────────

function fmtTime(t: string): string {
  const [h, m] = t.split(':');
  const hour = parseInt(h);
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
}

function ActiveMatchCard({ match, myUserId, onSubmitted }: {
  match: MatchResponse;
  myUserId: number;
  onSubmitted: () => void;
}) {
  const iAmP1 = match.player1Id === myUserId;
  const opponent = iAmP1 ? match.player2DisplayName : match.player1DisplayName;

  const [myWins, setMyWins] = useState(0);
  const [oppWins, setOppWins] = useState(0);
  const [draws, setDraws] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');
    setSubmitting(true);
    try {
      const p1Wins = iAmP1 ? myWins : oppWins;
      const p2Wins = iAmP1 ? oppWins : myWins;
      await recordMatchResult(match.id, p1Wins, p2Wins, draws);
      onSubmitted();
    } catch {
      setError('Failed to submit. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={ac.card}>
      <div style={ac.header}>
        <span style={ac.label}>Your Match — Round {match.round}</span>
        <span style={ac.vs}>vs <strong style={ac.opponent}>{opponent}</strong></span>
      </div>

      <p style={ac.hint}>Enter the number of games won, lost, and drawn in this matchup:</p>

      <div style={ac.inputs}>
        <div style={ac.inputGroup}>
          <label style={ac.inputLabel}>Your Wins</label>
          <input
            style={ac.input}
            type="number" min={0} max={99} value={myWins}
            onChange={(e) => setMyWins(Math.max(0, parseInt(e.target.value) || 0))}
          />
        </div>
        <div style={ac.inputGroup}>
          <label style={ac.inputLabel}>{opponent}&apos;s Wins</label>
          <input
            style={ac.input}
            type="number" min={0} max={99} value={oppWins}
            onChange={(e) => setOppWins(Math.max(0, parseInt(e.target.value) || 0))}
          />
        </div>
        <div style={ac.inputGroup}>
          <label style={ac.inputLabel}>Draws</label>
          <input
            style={ac.input}
            type="number" min={0} max={99} value={draws}
            onChange={(e) => setDraws(Math.max(0, parseInt(e.target.value) || 0))}
          />
        </div>
      </div>

      {error && <p style={ac.error}>{error}</p>}

      <button style={ac.btn} onClick={handleSubmit} disabled={submitting}>
        {submitting ? 'Submitting…' : 'Submit Result'}
      </button>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = { Upcoming: '#f59e0b', InProgress: '#22c55e', Completed: '#64748b', Planning: '#94a3b8' };
  const color = colors[status] ?? '#94a3b8';
  const label = status === 'InProgress' ? 'In Progress' : status;
  return <span style={{ color, border: `1px solid ${color}`, borderRadius: '999px', padding: '1px 8px', fontSize: '12px' }}>{label}</span>;
}

const s: Record<string, React.CSSProperties> = {
  loading: { color: '#94a3b8', textAlign: 'center', padding: '40px' },
  header: { display: 'flex', justifyContent: 'space-between', marginBottom: '24px', gap: '16px', flexWrap: 'wrap' },
  title: { color: '#a855f7', margin: '0 0 8px 0', fontSize: '22px' },
  meta: { color: '#94a3b8', margin: '0 0 8px 0', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  desc: { color: '#cbd5e1', margin: 0, fontSize: '14px' },
  actions: { display: 'flex', flexDirection: 'column', gap: '8px' },
  playerCount: { color: '#94a3b8', fontSize: '14px', margin: 0 },
  btnPrimary: { backgroundColor: '#a855f7', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontSize: '15px' },
  btnDanger: { backgroundColor: '#dc2626', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontSize: '15px' },
  btnWarning: { backgroundColor: '#d97706', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontSize: '15px' },
  btnDeck: { backgroundColor: '#0ea5e9', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontSize: '15px' },
  proxyNoticeAllowed: { backgroundColor: '#14291e', border: '1px solid #4ade80', color: '#86efac', padding: '8px 12px', borderRadius: '6px', fontSize: '13px', maxWidth: '220px', textAlign: 'right' },
  proxyNoticeBanned: { backgroundColor: '#3b1c1c', border: '1px solid #ef4444', color: '#fca5a5', padding: '8px 12px', borderRadius: '6px', fontSize: '13px', maxWidth: '220px', textAlign: 'right' },
  registeredBadge: { color: '#22c55e', fontSize: '13px', border: '1px solid #22c55e', borderRadius: '999px', padding: '2px 10px' },
  msg: { backgroundColor: '#1e3a5f', color: '#93c5fd', padding: '12px', borderRadius: '6px', marginBottom: '16px', fontSize: '14px' },
  eliminatedNotice: { backgroundColor: '#3b1c1c', color: '#f87171', border: '1px solid #ef4444', padding: '12px', borderRadius: '6px', marginBottom: '16px', fontSize: '14px' },
  droppedNotice: { backgroundColor: '#1c1e2e', color: '#94a3b8', border: '1px solid #475569', padding: '12px', borderRadius: '6px', marginBottom: '16px', fontSize: '14px' },
  droppedNoticeTemp: { backgroundColor: '#1c2a1e', color: '#86efac', border: '1px solid #4ade80', padding: '12px', borderRadius: '6px', marginBottom: '16px', fontSize: '14px' },
  grid: { display: 'grid', gap: '24px', marginTop: '8px' },
  sectionTitle: { color: '#e2e8f0', fontSize: '16px', marginBottom: '12px' },
  empty: { color: '#94a3b8', fontSize: '14px' },
  list: { listStyle: 'none', padding: 0, margin: 0 },
  listItem: { color: '#cbd5e1', padding: '10px 12px', backgroundColor: '#16213e', borderRadius: '6px', marginBottom: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  outBadge: { backgroundColor: '#3b1c1c', color: '#ef4444', fontSize: '10px', padding: '1px 6px', borderRadius: '999px' },
  droppedBadge: { backgroundColor: '#1c1e2e', color: '#94a3b8', fontSize: '10px', padding: '1px 6px', borderRadius: '999px', marginLeft: '6px' },
  matchItem: { display: 'flex', gap: '6px', alignItems: 'center', padding: '10px 12px', backgroundColor: '#16213e', borderRadius: '6px', marginBottom: '6px', color: '#cbd5e1', fontSize: '14px', flexWrap: 'wrap' },
  byeRow: { display: 'flex', alignItems: 'center', gap: '8px' },
  byeBadge: { backgroundColor: '#1e3a5f', color: '#38bdf8', fontSize: '11px', padding: '1px 8px', borderRadius: '999px' },
  vs: { color: '#475569', fontSize: '12px' },
  winner: { color: '#22c55e', fontWeight: 600 },
  matchResult: { marginLeft: 'auto', color: '#a855f7', fontSize: '13px', whiteSpace: 'nowrap' },
};

const ac: Record<string, React.CSSProperties> = {
  card: { backgroundColor: '#1a2d4a', border: '2px solid #a855f7', borderRadius: '10px', padding: '20px', marginBottom: '24px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' },
  label: { color: '#a855f7', fontWeight: 700, fontSize: '15px', textTransform: 'uppercase', letterSpacing: '0.05em' },
  vs: { color: '#94a3b8', fontSize: '14px' },
  opponent: { color: '#e2e8f0', fontWeight: 700 },
  hint: { color: '#64748b', fontSize: '13px', margin: '0 0 16px 0' },
  inputs: { display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '16px' },
  inputGroup: { display: 'flex', flexDirection: 'column', gap: '6px', flex: '1', minWidth: '80px' },
  inputLabel: { color: '#94a3b8', fontSize: '13px', fontWeight: 500 },
  input: { backgroundColor: '#0f3460', border: '1px solid #475569', borderRadius: '6px', color: '#e2e8f0', padding: '10px 12px', fontSize: '18px', fontWeight: 700, textAlign: 'center', width: '100%', boxSizing: 'border-box' },
  error: { color: '#f87171', fontSize: '13px', margin: '0 0 12px 0' },
  btn: { width: '100%', padding: '14px', backgroundColor: '#a855f7', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '16px', fontWeight: 700 },
};
