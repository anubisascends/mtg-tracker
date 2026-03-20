import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import publicClient from '../../api/publicClient';
import { EventResponse } from '../../api/events';
import { MatchResponse } from '../../api/matches';
import { EventPlayerScore } from '../../api/scores';
import { useTimer, formatTimer } from '../../hooks/useTimer';

const POLL_MS = 5000;

const PHASE_LABELS: Record<string, string> = {
  Initializing:  'Initializing',
  Drafting:      'Drafting',
  DeckBuilding:  'Deck Build',
  PodAssignment: 'Pods',
  Playing:       'Playing',
};

const LIFECYCLE_LABELS: Record<string, string> = {
  Planning:   'Planning',
  Upcoming:   'Upcoming',
  InProgress: 'In Progress',
  Completed:  'Completed',
};

function statusColor(s: string) {
  return ({ Planning: '#94a3b8', Upcoming: '#f59e0b', InProgress: '#22c55e', Completed: '#64748b' } as Record<string, string>)[s] ?? '#94a3b8';
}

type Orientation = 'landscape' | 'portrait';

// ── Main page ─────────────────────────────────────────────────────────────────

export default function EventStatusPage() {
  const { id } = useParams<{ id: string }>();
  const [orientation, setOrientation] = useState<Orientation>(
    () => (localStorage.getItem('tv-orientation') as Orientation) ?? 'landscape'
  );
  const [event, setEvent]   = useState<EventResponse | null>(null);
  const [matches, setMatches] = useState<MatchResponse[]>([]);
  const [scores, setScores]   = useState<EventPlayerScore[]>([]);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [loading, setLoading]   = useState(true);
  const [notFound, setNotFound] = useState(false);

  const fetchData = () => {
    Promise.all([
      publicClient.get<EventResponse>(`/events/${id}`),
      publicClient.get<MatchResponse[]>(`/events/${id}/matches`),
      publicClient.get<EventPlayerScore[]>(`/events/${id}/scores`),
    ]).then(([evRes, matchRes, scoreRes]) => {
      setEvent(evRes.data);
      setMatches(matchRes.data);
      setScores(scoreRes.data);
      setLastUpdated(new Date());
      setNotFound(false);
      setLoading(false);
    }).catch(() => { setNotFound(true); setLoading(false); });
  };

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, POLL_MS);
    return () => clearInterval(t);
  }, [id]);

  const toggleOrientation = () => {
    const next: Orientation = orientation === 'landscape' ? 'portrait' : 'landscape';
    setOrientation(next);
    localStorage.setItem('tv-orientation', next);
  };

  if (loading)  return <Center>Loading…</Center>;
  if (notFound) return <Center><Link to="/status" style={{ color: '#a855f7', marginRight: 12 }}>← Back</Link>Event not found.</Center>;
  if (!event)   return null;

  const color        = statusColor(event.status);
  const currentMatches = event.currentRound > 0
    ? matches.filter(m => m.round === event.currentRound)
    : matches;

  const sharedProps = { event, currentMatches, scores };

  return (
    <div style={page.root}>
      {/* ── Header ── */}
      <header style={page.header}>
        <div style={page.titleGroup}>
          <span style={{ ...page.dot, background: color, boxShadow: `0 0 12px ${color}` }} />
          <h1 style={page.title}>{event.name}</h1>
          <span style={{ ...page.badge, color, borderColor: color }}>
            {LIFECYCLE_LABELS[event.status]}
          </span>
          {event.status === 'InProgress' && event.runPhase && (
            <span style={{ ...page.badge, color: '#a855f7', borderColor: '#a855f7' }}>
              {PHASE_LABELS[event.runPhase] ?? event.runPhase}
            </span>
          )}
          {event.status === 'Completed' && (
            <span style={{ ...page.badge, color: '#22c55e', borderColor: '#22c55e' }}>
              Complete
            </span>
          )}
        </div>

        <div style={page.metaRow}>
          {[
            event.format,
            new Date(event.date).toLocaleDateString(),
            `${event.registeredCount}/${event.maxPlayers} players`,
            event.eliminationType ? event.eliminationType.replace(/([A-Z])/g, ' $1').trim() : null,
            event.currentRound > 0 ? `Round ${event.currentRound}` : null,
          ].filter(Boolean).map((item, i, arr) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: i === arr.length - 1 && event.currentRound > 0 ? '#a855f7' : '#64748b', fontWeight: i === arr.length - 1 && event.currentRound > 0 ? 700 : 400, fontSize: '15px' }}>{item}</span>
              {i < arr.length - 1 && <span style={{ color: '#2d3748' }}>•</span>}
            </span>
          ))}
        </div>

        <TimerDisplay timerStartedAt={event.timerStartedAt} timerDurationSeconds={event.timerDurationSeconds} />

        <div style={page.controls}>
          <span style={page.live}>● LIVE&nbsp;&nbsp;{lastUpdated.toLocaleTimeString()}</span>
          <button style={page.orientBtn} onClick={toggleOrientation}>
            {orientation === 'landscape' ? '⬒ Portrait' : '⬓ Landscape'}
          </button>
          <Link to="/status" style={page.back}>← All Events</Link>
        </div>
      </header>

      {/* ── Content ── */}
      {orientation === 'landscape'
        ? <LandscapeView {...sharedProps} />
        : <PortraitView  {...sharedProps} />
      }
    </div>
  );
}

// ── Layout views ──────────────────────────────────────────────────────────────

interface ViewProps {
  event: EventResponse;
  currentMatches: MatchResponse[];
  scores: EventPlayerScore[];
}

function LandscapeView({ event, currentMatches, scores }: ViewProps) {
  return (
    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr auto', gap: '10px', padding: '10px', overflow: 'hidden', minHeight: 0 }}>
      <Panel label={event.currentRound > 0 ? `Round ${event.currentRound} — Matches` : 'Matches'}>
        <MatchList matches={currentMatches} large />
      </Panel>
      <Panel label="Standings">
        <Standings scores={scores} />
      </Panel>
    </div>
  );
}

function PortraitView({ event, currentMatches, scores }: ViewProps) {
  return (
    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr auto', gap: '10px', padding: '10px', overflow: 'hidden', minHeight: 0 }}>
      <Panel label={event.currentRound > 0 ? `Round ${event.currentRound} — Matches` : 'Matches'}>
        <MatchList matches={currentMatches} />
      </Panel>
      <Panel label="Standings">
        <Standings scores={scores} />
      </Panel>
    </div>
  );
}

// ── Shared components ─────────────────────────────────────────────────────────

function Panel({ label, children, compact }: { label: string; children: React.ReactNode; compact?: boolean }) {
  return (
    <div style={{ background: '#161b27', border: '1px solid #1e2636', borderRadius: '10px', display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
      <div style={{ padding: compact ? '8px 16px' : '12px 18px', borderBottom: '1px solid #1e2636', flexShrink: 0 }}>
        <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: compact ? '10px 16px' : '16px 18px' }}>
        {children}
      </div>
    </div>
  );
}

function MatchList({ matches, large }: { matches: MatchResponse[]; large?: boolean }) {
  if (matches.length === 0) return <Empty>No matches yet.</Empty>;
  const sz = large
    ? { player: '22px', score: '30px', detail: '14px', gap: '12px' }
    : { player: '17px', score: '22px', detail: '13px', gap: '8px' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: sz.gap }}>
      {matches.map((m) => {
        if (m.isBye) return (
          <div key={m.id} style={mc.card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: sz.player, fontWeight: 600, color: '#cbd5e1' }}>{m.player1DisplayName}</span>
              <span style={mc.byeBadge}>BYE +1pt</span>
            </div>
          </div>
        );
        const p1Win = !m.isPending && m.player1Wins > m.player2Wins;
        const p2Win = !m.isPending && m.player2Wins > m.player1Wins;
        return (
          <div key={m.id} style={m.isPending ? mc.pending : mc.done}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: sz.player, fontWeight: 700, color: p1Win ? '#22c55e' : '#e2e8f0', flex: 1, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {m.player1DisplayName}
              </span>
              <span style={{ fontSize: sz.score, fontWeight: 800, color: m.isPending ? '#334155' : '#a855f7', minWidth: large ? '80px' : '60px', textAlign: 'center', flexShrink: 0 }}>
                {m.isPending ? 'vs' : `${m.player1Wins}–${m.player2Wins}${m.draws > 0 ? `–${m.draws}` : ''}`}
              </span>
              <span style={{ fontSize: sz.player, fontWeight: 700, color: p2Win ? '#22c55e' : '#e2e8f0', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {m.player2DisplayName}
              </span>
            </div>
            {!m.isPending && (
              <div style={{ textAlign: 'center', fontSize: sz.detail, color: '#475569', marginTop: '4px' }}>
                {p1Win ? `${m.player1DisplayName} wins` : p2Win ? `${m.player2DisplayName} wins` : 'Draw'}
                {m.draws > 0 && ` • ${m.draws} draw${m.draws > 1 ? 's' : ''}`}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Standings({ scores }: { scores: EventPlayerScore[] }) {
  if (scores.length === 0) return <Empty>No standings yet.</Empty>;
  return (
    <div>
      <table style={{ borderCollapse: 'separate', borderSpacing: '0 3px', width: '100%' }}>
        <tbody>
          {scores.map((s, i) => {
            const bg = i % 2 === 0 ? '#1a2035' : '#141929';
            const first = i === 0 && !s.isDropped && !s.isEliminated;
            const cellBase: React.CSSProperties = { background: bg, padding: '9px 10px', verticalAlign: 'middle' };
            return (
              <tr key={s.playerId} style={{ opacity: s.isEliminated || s.isDropped ? 0.45 : 1 }}>
                {/* Rank */}
                <td style={{ ...cellBase, paddingLeft: '12px', borderLeft: `3px solid ${first ? '#a855f7' : 'transparent'}`, borderRadius: '8px 0 0 8px', fontSize: '18px', fontWeight: 800, color: s.isDropped ? '#ef4444' : first ? '#a855f7' : '#64748b', textAlign: 'center', whiteSpace: 'nowrap' }}>
                  {i + 1}
                </td>
                {/* Name */}
                <td style={{ ...cellBase, fontSize: '18px', fontWeight: 600, color: s.isDropped ? '#ef4444' : '#f1f5f9', textDecoration: s.isDropped ? 'line-through' : 'none', whiteSpace: 'nowrap' }}>
                  {s.playerDisplayName}
                  {s.isEliminated && (
                    <span style={{ marginLeft: '8px', background: '#7f1d1d', color: '#fca5a5', fontSize: '11px', fontWeight: 700, padding: '2px 7px', borderRadius: '999px', verticalAlign: 'middle' }}>OUT</span>
                  )}
                  {s.isDropped && (
                    <span style={{ marginLeft: '8px', background: '#3b0c0c', color: '#ef4444', fontSize: '11px', fontWeight: 700, padding: '2px 7px', borderRadius: '999px', verticalAlign: 'middle', textDecoration: 'none', display: 'inline-block' }}>DROPPED</span>
                  )}
                </td>
                {/* W / L / D / B */}
                <td style={{ ...cellBase, whiteSpace: 'nowrap' }}>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#22c55e' }}>{s.matchWins}W</span>
                  <span style={{ margin: '0 4px', color: '#2d3748' }}>·</span>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#f87171' }}>{s.matchLosses}L</span>
                  {s.matchDraws > 0 && <>
                    <span style={{ margin: '0 4px', color: '#2d3748' }}>·</span>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#94a3b8' }}>{s.matchDraws}D</span>
                  </>}
                  {s.byes > 0 && <>
                    <span style={{ margin: '0 4px', color: '#2d3748' }}>·</span>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#38bdf8' }}>{s.byes}B</span>
                  </>}
                </td>
                {/* Points */}
                <td style={{ ...cellBase, paddingRight: '14px', borderRadius: '0 8px 8px 0', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <span style={{ fontSize: '26px', fontWeight: 800, color: '#a855f7', lineHeight: 1 }}>{s.points}</span>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#7c3aed', marginLeft: '3px' }}>pts</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p style={{ color: '#475569', fontSize: '11px', margin: '6px 0 0', textAlign: 'center' }}>
        Win = 2pts &nbsp;·&nbsp; Draw = 1pt &nbsp;·&nbsp; Bye = 1pt
      </p>
    </div>
  );
}

function TimerDisplay({ timerStartedAt, timerDurationSeconds }: { timerStartedAt: string | null; timerDurationSeconds: number }) {
  const remaining = useTimer(timerStartedAt, timerDurationSeconds);
  if (remaining === null) return null;
  const isNeg = remaining < 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: isNeg ? '#2d0a0a' : '#0a1a1a', border: `2px solid ${isNeg ? '#ef4444' : '#22c55e'}`, borderRadius: '10px', padding: '6px 20px', boxShadow: `0 0 18px ${isNeg ? '#ef444455' : '#22c55e55'}` }}>
      <span style={{ fontSize: '11px', fontWeight: 700, color: isNeg ? '#ef4444' : '#22c55e', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Timer</span>
      <span style={{ fontSize: '36px', fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: isNeg ? '#ef4444' : '#22c55e', lineHeight: 1, letterSpacing: '0.02em' }}>
        {formatTimer(remaining)}
      </span>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <span style={{ color: '#334155', fontSize: '16px' }}>{children}</span>;
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#94a3b8', fontSize: '20px', fontFamily: 'system-ui', background: '#0d1117' }}>
      {children}
    </div>
  );
}

// ── Style objects ─────────────────────────────────────────────────────────────

const page: Record<string, React.CSSProperties> = {
  root:       { height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: '#0d1117', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#e2e8f0' },
  header:     { display: 'flex', alignItems: 'center', gap: '16px', padding: '10px 18px', background: '#161b27', borderBottom: '2px solid #1e2636', flexShrink: 0, flexWrap: 'wrap' },
  titleGroup: { display: 'flex', alignItems: 'center', gap: '12px' },
  dot:        { width: '12px', height: '12px', borderRadius: '50%', flexShrink: 0 },
  title:      { margin: 0, fontSize: '26px', fontWeight: 800, color: '#f1f5f9', whiteSpace: 'nowrap' },
  badge:      { fontSize: '13px', border: '1px solid', borderRadius: '999px', padding: '3px 12px', flexShrink: 0 },
  metaRow:    { display: 'flex', alignItems: 'center', gap: '0', flex: 1, flexWrap: 'wrap' },
  controls:   { display: 'flex', alignItems: 'center', gap: '12px', marginLeft: 'auto', flexShrink: 0 },
  live:       { color: '#22c55e', fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap' },
  orientBtn:  { background: '#1a2035', border: '1px solid #334155', color: '#a855f7', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap' },
  back:       { color: '#334155', textDecoration: 'none', fontSize: '13px', whiteSpace: 'nowrap' },
};

const mc: Record<string, React.CSSProperties> = {
  card:    { background: '#131a28', border: '1px solid #1e2636', borderRadius: '8px', padding: '12px 16px' },
  pending: { background: '#1a2035', border: '1px dashed #2d3748', borderRadius: '8px', padding: '12px 16px' },
  done:    { background: '#131a28', border: '1px solid #1e2636', borderRadius: '8px', padding: '12px 16px' },
  byeBadge: { background: '#1e3a5f', color: '#38bdf8', fontSize: '13px', padding: '3px 12px', borderRadius: '999px' },
};
