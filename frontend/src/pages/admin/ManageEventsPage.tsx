import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getEvents, deleteEvent, advanceEvent, advanceRunPhase, reverseRunPhase, reverseStatus, generateNextRound, createPairing, startTimer, stopTimer, EventResponse } from '../../api/events';
import { getAllDecks, DeckSubmissionResponse } from '../../api/decks';
import { getEventMatches, recordMatchResult, deleteMatch, reopenMatch, MatchResponse } from '../../api/matches';
import { getEventScores, EventPlayerScore } from '../../api/scores';
import { useTimer, formatTimer } from '../../hooks/useTimer';
import { getPlayers, PlayerResponse } from '../../api/players';
import { getEventRegistrations, adminRegisterPlayer, cancelRegistration, dropPlayer, undropPlayer, RegistrationResponse } from '../../api/registrations';

const NEXT_STATUS_LABEL: Record<string, string> = {
  Planning: 'Open for Registration',
  Upcoming: 'Start Event',
};

const PHASE_LABELS: Record<string, string> = {
  Initializing:  'Initializing',
  Drafting:      'Drafting',
  DeckBuilding:  'Deck Building',
  PodAssignment: 'Pod Assignment',
  Playing:       'Playing',
};

const FORMAT_PHASES: Record<string, string[]> = {
  Draft:     ['Initializing', 'Drafting', 'DeckBuilding', 'Playing', 'Completed'],
  Sealed:    ['Initializing', 'DeckBuilding', 'Playing', 'Completed'],
  Commander: ['Initializing', 'PodAssignment', 'Playing', 'Completed'],
};
const CONSTRUCTED_PHASES = ['Initializing', 'Playing', 'Completed'];

function getPhasesForFormat(format: string): string[] {
  return FORMAT_PHASES[format] ?? CONSTRUCTED_PHASES;
}

export default function ManageEventsPage() {
  const [events, setEvents] = useState<EventResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedEventId, setExpandedEventId] = useState<number | null>(null);
  const [expandedPlayersId, setExpandedPlayersId] = useState<number | null>(null);
  const [expandedTimerId, setExpandedTimerId] = useState<number | null>(null);
  const [expandedDecksId, setExpandedDecksId] = useState<number | null>(null);

  useEffect(() => {
    getEvents().then(setEvents).finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this event? This cannot be undone.')) return;
    await deleteEvent(id);
    setEvents(events.filter((e) => e.id !== id));
  };

  const handleAdvanceStatus = async (id: number, currentStatus: string) => {
    const label = NEXT_STATUS_LABEL[currentStatus];
    if (!confirm(`Advance event: ${label}?`)) return;
    const updated = await advanceEvent(id);
    setEvents(events.map((e) => (e.id === id ? updated : e)));
  };

  const handleAdvanceRunPhase = async (id: number, nextPhase: string) => {
    const isCompleting = nextPhase === 'Completed';
    const msg = isCompleting
      ? 'Complete this event? Stats will be tallied and this cannot be undone.'
      : `Advance run phase to "${PHASE_LABELS[nextPhase] ?? nextPhase}"?`;
    if (!confirm(msg)) return;
    const updated = await advanceRunPhase(id);
    setEvents(events.map((e) => (e.id === id ? updated : e)));
    if (isCompleting) setExpandedEventId(null);
  };

  const handleReverseRunPhase = async (id: number, prevPhase: string) => {
    if (!confirm(`Go back to "${PHASE_LABELS[prevPhase] ?? prevPhase}"?`)) return;
    try {
      const updated = await reverseRunPhase(id);
      setEvents(events.map((e) => (e.id === id ? updated : e)));
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      alert(err?.response?.data?.message ?? 'Could not go back.');
    }
  };

  const handleReverseStatus = async (id: number) => {
    if (!confirm('Go back to the previous event status?')) return;
    try {
      const updated = await reverseStatus(id);
      setEvents(events.map((e) => (e.id === id ? updated : e)));
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      alert(err?.response?.data?.message ?? 'Could not go back.');
    }
  };

  const toggleMatches = (id: number) => {
    setExpandedEventId((prev) => (prev === id ? null : id));
  };

  const togglePlayers = (id: number) => {
    setExpandedPlayersId((prev) => (prev === id ? null : id));
  };

  const toggleTimer = (id: number) => {
    setExpandedTimerId((prev) => (prev === id ? null : id));
  };

  const toggleDecks = (id: number) => {
    setExpandedDecksId((prev) => (prev === id ? null : id));
  };

  if (loading) return <div style={styles.loading}>Loading...</div>;

  return (
    <div>
      <div style={styles.header}>
        <h1 style={styles.heading}>Manage Events</h1>
        <Link to="/admin/events/new" style={styles.createBtn}>+ Create Event</Link>
      </div>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Name</th>
            <th style={styles.th}>Format</th>
            <th style={styles.th}>Date</th>
            <th style={styles.th}>Status / Phase</th>
            <th style={styles.th}>Players</th>
            <th style={styles.th}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {events.map((ev) => {
            const phases = getPhasesForFormat(ev.format);
            const phaseIdx = ev.runPhase ? phases.indexOf(ev.runPhase) : -1;
            const next = phaseIdx >= 0 && phaseIdx < phases.length - 1 ? phases[phaseIdx + 1] : null;
            const prev = phaseIdx > 0 ? phases[phaseIdx - 1] : null;
            const canReverseStatus = ev.status === 'Upcoming' || (ev.status === 'InProgress' && ev.runPhase === 'Initializing');
            const isPlaying = ev.status === 'InProgress' && ev.runPhase === 'Playing';
            const isTimerPhase = ev.status === 'InProgress' && (ev.runPhase === 'Drafting' || ev.runPhase === 'DeckBuilding');
            const isExpanded = expandedEventId === ev.id;
            const canManagePlayers = ev.status === 'Planning' || ev.status === 'Upcoming' || ev.status === 'InProgress';
            const isPlayersExpanded = expandedPlayersId === ev.id;
            const isTimerExpanded = expandedTimerId === ev.id;
            const isDecksExpanded = expandedDecksId === ev.id;

            return (
              <>
                <tr key={ev.id}>
                  <td style={styles.td}>{ev.name}</td>
                  <td style={styles.td}>{ev.format}</td>
                  <td style={styles.td}>{new Date(ev.date).toLocaleDateString()}</td>
                  <td style={styles.td}>
                    <span style={{ ...styles.statusBadge, ...getStatusStyle(ev.status) }}>{formatStatus(ev.status)}</span>
                    {ev.status === 'InProgress' && ev.runPhase && (
                      <RunPhasePipeline format={ev.format} currentPhase={ev.runPhase} />
                    )}
                  </td>
                  <td style={styles.td}>{ev.registeredCount}/{ev.maxPlayers}</td>
                  <td style={styles.td}>
                    {canReverseStatus && (
                      <button onClick={() => handleReverseStatus(ev.id)} style={styles.backBtn} title="Go back to previous status">
                        ←
                      </button>
                    )}
                    {(ev.status === 'Planning' || ev.status === 'Upcoming') && (
                      <button onClick={() => handleAdvanceStatus(ev.id, ev.status)} style={styles.advanceBtn}>
                        {NEXT_STATUS_LABEL[ev.status]}
                      </button>
                    )}
                    {ev.status === 'InProgress' && prev && prev !== 'Completed' && (
                      <button
                        onClick={() => handleReverseRunPhase(ev.id, prev)}
                        style={styles.backBtn}
                        title={`Go back to ${PHASE_LABELS[prev] ?? prev}`}
                      >
                        ← {PHASE_LABELS[prev] ?? prev}
                      </button>
                    )}
                    {ev.status === 'InProgress' && next && (
                      <button
                        onClick={() => handleAdvanceRunPhase(ev.id, next)}
                        style={next === 'Completed' ? styles.completeBtn : styles.advanceBtn}
                      >
                        {next === 'Completed' ? 'Complete Event' : `→ ${PHASE_LABELS[next] ?? next}`}
                      </button>
                    )}
                    {isPlaying && (
                      <button
                        onClick={() => toggleMatches(ev.id)}
                        style={{ ...styles.matchesBtn, ...(isExpanded ? styles.matchesBtnActive : {}) }}
                      >
                        {isExpanded ? 'Hide Matches' : 'Matches'}
                      </button>
                    )}
                    {isTimerPhase && (
                      <button
                        onClick={() => toggleTimer(ev.id)}
                        style={{ ...styles.matchesBtn, ...(isTimerExpanded ? styles.matchesBtnActive : {}) }}
                      >
                        {isTimerExpanded ? 'Hide Timer' : 'Timer'}
                      </button>
                    )}
                    {canManagePlayers && (
                      <button
                        onClick={() => togglePlayers(ev.id)}
                        style={{ ...styles.matchesBtn, ...(isPlayersExpanded ? styles.matchesBtnActive : {}) }}
                      >
                        {isPlayersExpanded ? 'Hide Players' : 'Players'}
                      </button>
                    )}
                    {ev.requiresDeckRegistration && (
                      <button
                        onClick={() => toggleDecks(ev.id)}
                        style={{ ...styles.matchesBtn, ...(isDecksExpanded ? styles.matchesBtnActive : {}) }}
                      >
                        {isDecksExpanded ? 'Hide Decks' : 'Decks'}
                      </button>
                    )}
                    {ev.status === 'Planning' && (
                      <Link to={`/admin/events/${ev.id}/edit`} style={styles.editLink}>Edit</Link>
                    )}
                    {ev.status !== 'Planning' && (
                      <a href={`/status/${ev.id}`} target="_blank" rel="noopener noreferrer" style={styles.statusLink}>Status ↗</a>
                    )}
                    <button onClick={() => handleDelete(ev.id)} style={styles.deleteBtn}>Delete</button>
                  </td>
                </tr>
                {isExpanded && (
                  <tr key={`${ev.id}-matches`}>
                    <td colSpan={6} style={styles.matchesTd}>
                      <MatchPanel
                        eventId={ev.id}
                        currentRound={ev.currentRound}
                        eliminationType={ev.eliminationType}
                        timerStartedAt={ev.timerStartedAt}
                        timerDurationSeconds={ev.timerDurationSeconds}
                        onRoundAdvanced={(updated) => setEvents(events.map((e) => e.id === updated.id ? updated : e))}
                        onTimerChange={(updated) => setEvents(events.map((e) => e.id === updated.id ? updated : e))}
                      />
                    </td>
                  </tr>
                )}
                {isTimerExpanded && (
                  <tr key={`${ev.id}-timer`}>
                    <td colSpan={6} style={styles.matchesTd}>
                      <div style={{ backgroundColor: '#0d1f35', padding: '16px 24px', borderTop: '1px solid #1e293b' }}>
                        <TimerControl
                          eventId={ev.id}
                          timerStartedAt={ev.timerStartedAt}
                          timerDurationSeconds={ev.timerDurationSeconds}
                          onTimerChange={(updated) => setEvents(events.map((e) => e.id === updated.id ? updated : e))}
                        />
                      </div>
                    </td>
                  </tr>
                )}
                {isPlayersExpanded && (
                  <tr key={`${ev.id}-players`}>
                    <td colSpan={6} style={styles.matchesTd}>
                      <PlayersPanel
                        eventId={ev.id}
                        maxPlayers={ev.maxPlayers}
                      />
                    </td>
                  </tr>
                )}
                {isDecksExpanded && (
                  <tr key={`${ev.id}-decks`}>
                    <td colSpan={6} style={styles.matchesTd}>
                      <DecksPanel eventId={ev.id} proxiesAllowed={ev.proxiesAllowed} />
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function MatchPanel({ eventId, currentRound, eliminationType, timerStartedAt, timerDurationSeconds, onRoundAdvanced, onTimerChange }: {
  eventId: number;
  currentRound: number;
  eliminationType: string;
  timerStartedAt: string | null;
  timerDurationSeconds: number;
  onRoundAdvanced: (updated: EventResponse) => void;
  onTimerChange: (updated: EventResponse) => void;
}) {
  const [matches, setMatches] = useState<MatchResponse[]>([]);
  const [scores, setScores] = useState<EventPlayerScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState('');
  const [nextRoundError, setNextRoundError] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([getEventMatches(eventId), getEventScores(eventId)])
      .then(([m, s]) => { setMatches(m); setScores(s); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [eventId]);

  const handleResult = async (matchId: number, p1Wins: number, p2Wins: number, draws: number) => {
    await recordMatchResult(matchId, p1Wins, p2Wins, draws);
    setFeedback('Result recorded.');
    setTimeout(() => setFeedback(''), 2500);
    load();
  };

  const handleNextRound = async () => {
    setNextRoundError('');
    try {
      const updated = await generateNextRound(eventId);
      onRoundAdvanced(updated);
      load();
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } };
      setNextRoundError(err?.response?.data?.message ?? 'Failed to start next round.');
    }
  };

  const pending = matches.filter((m) => m.isPending && m.round === currentRound);
  const completed = matches.filter((m) => !m.isPending && m.round === currentRound);
  const activeCount = scores.filter((s) => !s.isEliminated && !s.isDropped).length;
  const allDone = pending.length === 0 && completed.length > 0;
  const canNextRound = allDone && activeCount >= 2;
  const isSwiss = eliminationType === 'Swiss';
  const totalPlayers = scores.length;
  const recommendedRounds = totalPlayers > 1 ? Math.ceil(Math.log2(totalPlayers)) : 0;

  const handleDrop = async (registrationId: number) => {
    try {
      await dropPlayer(eventId, registrationId);
      load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setFeedback(err?.response?.data?.message ?? 'Failed to drop player.');
    }
  };

  const handleUndrop = async (registrationId: number) => {
    try {
      await undropPlayer(eventId, registrationId);
      load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setFeedback(err?.response?.data?.message ?? 'Failed to undrop player.');
    }
  };

  const handleDeleteMatch = async (matchId: number) => {
    try {
      await deleteMatch(matchId);
      load();
    } catch {
      setFeedback('Failed to delete pairing.');
    }
  };

  const handleReopen = async (matchId: number) => {
    try {
      await reopenMatch(matchId);
      setFeedback('Match reopened — result cleared.');
      setTimeout(() => setFeedback(''), 3000);
      load();
    } catch {
      setFeedback('Failed to reopen match.');
    }
  };

  if (loading) return <div style={panelStyles.hint}>Loading matches...</div>;

  const activeUnpaired = scores.filter((s) => {
    if (s.isEliminated || s.isDropped) return false;
    return !matches.some((m) => m.round === currentRound && (m.player1Id === s.playerId || (!m.isBye && m.player2Id === s.playerId)));
  });

  return (
    <div style={panelStyles.container}>
      <div style={panelStyles.header}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <div style={panelStyles.title}>Round {currentRound} Matches</div>
          {isSwiss && recommendedRounds > 0 && (
            <div style={{ fontSize: '11px', color: currentRound >= recommendedRounds ? '#22c55e' : '#64748b' }}>
              {currentRound >= recommendedRounds
                ? `Recommended ${recommendedRounds} rounds complete`
                : `Recommended: ${recommendedRounds} rounds for ${totalPlayers} players`}
            </div>
          )}
        </div>
        {canNextRound && (
          <button style={panelStyles.nextRoundBtn} onClick={handleNextRound}>
            Start Round {currentRound + 1}
          </button>
        )}
      </div>
      {feedback && <div style={panelStyles.feedback}>{feedback}</div>}
      {nextRoundError && <div style={panelStyles.errorMsg}>{nextRoundError}</div>}

      <TimerControl
        eventId={eventId}
        timerStartedAt={timerStartedAt}
        timerDurationSeconds={timerDurationSeconds}
        onTimerChange={onTimerChange}
      />

      {activeUnpaired.length > 0 && (
        <PairingBuilder
          eventId={eventId}
          unpairedPlayers={activeUnpaired}
          allMatches={matches}
          onPairingCreated={load}
        />
      )}

      {pending.length === 0 && completed.length === 0 && activeUnpaired.length === 0 && (
        <div style={panelStyles.hint}>No matches for this round yet.</div>
      )}

      {pending.length > 0 && (
        <div style={panelStyles.section}>
          <div style={panelStyles.sectionLabel}>Pending</div>
          {pending.map((m) => (
            <PendingRow key={m.id} match={m} onRecord={handleResult} onDelete={handleDeleteMatch} />
          ))}
        </div>
      )}

      {completed.length > 0 && (
        <div style={panelStyles.section}>
          <div style={panelStyles.sectionLabel}>Completed</div>
          {completed.map((m) => (
            <div key={m.id} style={panelStyles.completedRow}>
              {m.isBye ? (
                <span style={panelStyles.players}>{m.player1DisplayName} <span style={panelStyles.byeBadge}>BYE</span></span>
              ) : (
                <span style={panelStyles.players}>
                  <span style={m.player1Wins > m.player2Wins ? panelStyles.winner : undefined}>{m.player1DisplayName}</span>
                  <span style={panelStyles.score}>{m.player1Wins}–{m.player2Wins}{m.draws > 0 ? `–${m.draws}` : ''}</span>
                  <span style={m.player2Wins > m.player1Wins ? panelStyles.winner : undefined}>{m.player2DisplayName}</span>
                </span>
              )}
              <span style={panelStyles.pts}>
                {m.player1Points} pts / {m.isBye ? '–' : `${m.player2Points} pts`}
              </span>
              {!m.isBye && (
                <button style={panelStyles.reopenBtn} onClick={() => handleReopen(m.id)} title="Clear result and reopen for re-entry">
                  Reopen
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {scores.length > 0 && (
        <div style={panelStyles.section}>
          <div style={panelStyles.sectionLabel}>Standings</div>
          <table style={panelStyles.table}>
            <thead>
              <tr>
                <th style={panelStyles.th}>#</th>
                <th style={panelStyles.th}>Player</th>
                <th style={panelStyles.th}>Pts</th>
                <th style={panelStyles.th}>W</th>
                <th style={panelStyles.th}>L</th>
                <th style={panelStyles.th}>D</th>
                <th style={panelStyles.th}>Bye</th>
                <th style={panelStyles.th}></th>
              </tr>
            </thead>
            <tbody>
              {scores.map((s, i) => {
                const isPermanentDrop = s.isDropped && s.droppedAtRound < currentRound;
                return (
                  <tr key={s.playerId} style={s.isEliminated || s.isDropped ? panelStyles.eliminatedRow : undefined}>
                    <td style={panelStyles.td}>{i + 1}</td>
                    <td style={panelStyles.td}>
                      {s.playerDisplayName}
                      {s.isEliminated && <span style={panelStyles.elimBadge}>OUT</span>}
                      {s.isDropped && <span style={panelStyles.dropBadge}>{isPermanentDrop ? 'DROPPED' : 'DROPPED*'}</span>}
                      {!s.isEliminated && !s.isDropped && eliminationType === 'DoubleElimination' && s.eventLosses === 1 && (
                        <span style={panelStyles.warnBadge}>1 loss</span>
                      )}
                    </td>
                    <td style={{ ...panelStyles.td, color: '#a855f7', fontWeight: 600 }}>{s.points}</td>
                    <td style={{ ...panelStyles.td, color: '#22c55e' }}>{s.matchWins}</td>
                    <td style={{ ...panelStyles.td, color: '#ef4444' }}>{s.matchLosses}</td>
                    <td style={panelStyles.td}>{s.matchDraws}</td>
                    <td style={panelStyles.td}>{s.byes}</td>
                    <td style={panelStyles.td}>
                      {!s.isEliminated && !s.isDropped && (
                        <button style={panelStyles.dropBtn} onClick={() => handleDrop(s.registrationId)}>Drop</button>
                      )}
                      {s.isDropped && !isPermanentDrop && (
                        <button style={panelStyles.undropBtn} onClick={() => handleUndrop(s.registrationId)}>Undrop</button>
                      )}
                      {isPermanentDrop && (
                        <span style={{ color: '#475569', fontSize: '11px' }}>Permanent</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PendingRow({ match, onRecord, onDelete }: {
  match: MatchResponse;
  onRecord: (id: number, p1Wins: number, p2Wins: number, draws: number) => void;
  onDelete: (id: number) => void;
}) {
  const [p1Wins, setP1Wins] = useState(0);
  const [p2Wins, setP2Wins] = useState(0);
  const [draws, setDraws] = useState(0);

  return (
    <div style={panelStyles.pendingRow}>
      <span style={panelStyles.players}>
        {match.player1DisplayName}
        <span style={panelStyles.vs}>vs</span>
        {match.player2DisplayName}
      </span>
      <div style={panelStyles.options}>
        <label style={panelStyles.inputLabel}>
          {match.player1DisplayName} wins
          <input
            type="number" min={0} value={p1Wins} style={panelStyles.numInput}
            onChange={(e) => setP1Wins(Math.max(0, parseInt(e.target.value) || 0))}
          />
        </label>
        <label style={panelStyles.inputLabel}>
          {match.player2DisplayName} wins
          <input
            type="number" min={0} value={p2Wins} style={panelStyles.numInput}
            onChange={(e) => setP2Wins(Math.max(0, parseInt(e.target.value) || 0))}
          />
        </label>
        <label style={panelStyles.inputLabel}>
          Draws
          <input
            type="number" min={0} value={draws} style={panelStyles.numInput}
            onChange={(e) => setDraws(Math.max(0, parseInt(e.target.value) || 0))}
          />
        </label>
        <button
          style={panelStyles.submitBtn}
          onClick={() => onRecord(match.id, p1Wins, p2Wins, draws)}
        >
          Submit
        </button>
        <button
          style={panelStyles.deletePairingBtn}
          onClick={() => onDelete(match.id)}
          title="Remove pairing"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

function RunPhasePipeline({ format, currentPhase }: { format: string; currentPhase: string }) {
  const phases = getPhasesForFormat(format).filter((p) => p !== 'Completed');
  return (
    <div style={styles.pipeline}>
      {phases.map((phase, i) => {
        const allPhases = getPhasesForFormat(format);
        const currentIdx = allPhases.indexOf(currentPhase);
        const phaseIdx = allPhases.indexOf(phase);
        const isDone = phaseIdx < currentIdx;
        const isCurrent = phase === currentPhase;
        return (
          <span key={phase} style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
            {i > 0 && <span style={styles.pipelineSep}>›</span>}
            <span style={{
              ...styles.phaseChip,
              ...(isCurrent ? styles.phaseChipActive : {}),
              ...(isDone ? styles.phaseChipDone : {}),
            }}>
              {PHASE_LABELS[phase] ?? phase}
            </span>
          </span>
        );
      })}
    </div>
  );
}

function PairingBuilder({ eventId, unpairedPlayers, allMatches, onPairingCreated }: {
  eventId: number;
  unpairedPlayers: { playerId: number; playerDisplayName: string }[];
  allMatches: MatchResponse[];
  onPairingCreated: () => void;
}) {
  const [p1Id, setP1Id] = useState<number | ''>('');
  const [p2Id, setP2Id] = useState<number | 'bye' | ''>('');
  const [error, setError] = useState('');

  const handlePair = async () => {
    if (p1Id === '') { setError('Select Player 1.'); return; }
    if (p2Id === '') { setError('Select Player 2 or choose Bye.'); return; }
    if (p2Id !== 'bye' && p1Id === p2Id) { setError('Players must be different.'); return; }
    setError('');
    try {
      await createPairing(eventId, p1Id as number, p2Id === 'bye' ? null : p2Id as number);
      setP1Id('');
      setP2Id('');
      onPairingCreated();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err?.response?.data?.message ?? 'Failed to create pairing.');
    }
  };

  const isRematch = p1Id !== '' && p2Id !== '' && p2Id !== 'bye' &&
    allMatches.some((m) => !m.isBye && (
      (m.player1Id === p1Id && m.player2Id === (p2Id as number)) ||
      (m.player1Id === (p2Id as number) && m.player2Id === p1Id)
    ));

  const p2Options = unpairedPlayers.filter((p) => p.playerId !== p1Id);

  return (
    <div style={pb.wrap}>
      <div style={pb.label}>Create Pairing</div>
      <div style={pb.row}>
        <select
          style={pb.select}
          value={p1Id}
          onChange={(e) => { setP1Id(e.target.value === '' ? '' : parseInt(e.target.value)); setP2Id(''); }}
        >
          <option value="">— Player 1 —</option>
          {unpairedPlayers.map((p) => (
            <option key={p.playerId} value={p.playerId}>{p.playerDisplayName}</option>
          ))}
        </select>
        <span style={pb.vs}>vs</span>
        <select
          style={pb.select}
          value={p2Id}
          onChange={(e) => setP2Id(e.target.value === '' ? '' : e.target.value === 'bye' ? 'bye' : parseInt(e.target.value))}
          disabled={p1Id === ''}
        >
          <option value="">— Player 2 —</option>
          <option value="bye">BYE</option>
          {p2Options.map((p) => (
            <option key={p.playerId} value={p.playerId}>{p.playerDisplayName}</option>
          ))}
        </select>
        <button style={pb.btn} onClick={handlePair}>Pair</button>
      </div>
      {isRematch && <div style={pb.warning}>These players have already been paired this event.</div>}
      {error && <div style={pb.error}>{error}</div>}
      {unpairedPlayers.length > 0 && (
        <div style={pb.unpaired}>
          Unpaired: {unpairedPlayers.map((p) => p.playerDisplayName).join(', ')}
        </div>
      )}
    </div>
  );
}

const pb: Record<string, React.CSSProperties> = {
  wrap: { backgroundColor: '#0a1929', border: '1px solid #1e3a5f', borderRadius: '6px', padding: '12px 16px', marginBottom: '16px' },
  label: { color: '#64748b', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' },
  row: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' },
  select: { padding: '6px 10px', backgroundColor: '#0f3460', border: '1px solid #334155', borderRadius: '4px', color: '#e2e8f0', fontSize: '13px', minWidth: '150px' },
  vs: { color: '#475569', fontSize: '12px', fontWeight: 600 },
  btn: { padding: '6px 16px', backgroundColor: '#a855f7', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 },
  warning: { color: '#f59e0b', fontSize: '12px', marginTop: '8px' },
  error: { color: '#f87171', fontSize: '12px', marginTop: '8px' },
  unpaired: { color: '#475569', fontSize: '12px', marginTop: '8px' },
};

function DecksPanel({ eventId, proxiesAllowed }: { eventId: number; proxiesAllowed: boolean }) {
  const [decks, setDecks] = useState<DeckSubmissionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    getAllDecks(eventId).then(setDecks).finally(() => setLoading(false));
  }, [eventId]);

  if (loading) return <div style={panelStyles.hint}>Loading decks...</div>;

  const deck = decks.find((d) => d.id === selected);
  const SECTION_ORDER = ['Commander', 'MainDeck', 'Sideboard'];
  const SECTION_LABELS: Record<string, string> = { Commander: 'Commander', MainDeck: 'Main Deck', Sideboard: 'Sideboard' };

  return (
    <div style={panelStyles.container}>
      <div style={panelStyles.header}>
        <div style={panelStyles.title}>Submitted Decks ({decks.length})</div>
        {!proxiesAllowed && <span style={dk.noproxy}>Proxies Not Allowed</span>}
        {proxiesAllowed && <span style={dk.proxybadge}>Proxies Allowed</span>}
      </div>

      {decks.length === 0 ? (
        <div style={panelStyles.hint}>No decks submitted yet.</div>
      ) : (
        <div style={dk.layout}>
          <div style={dk.playerList}>
            {decks.map((d) => (
              <button
                key={d.id}
                style={{ ...dk.playerBtn, ...(selected === d.id ? dk.playerBtnActive : {}) }}
                onClick={() => setSelected(selected === d.id ? null : d.id)}
              >
                <span>{d.playerDisplayName}</span>
                <span style={dk.cardCount}>{d.cards.reduce((sum, c) => sum + c.quantity, 0)} cards</span>
              </button>
            ))}
          </div>
          {deck && (
            <div style={dk.deckView}>
              <div style={dk.deckMeta}>
                Submitted {new Date(deck.submittedAt).toLocaleString()}
                {deck.updatedAt !== deck.submittedAt && ` · Updated ${new Date(deck.updatedAt).toLocaleString()}`}
              </div>
              {SECTION_ORDER.map((section) => {
                const cards = deck.cards.filter((c) => c.section === section);
                if (cards.length === 0) return null;
                const total = cards.reduce((s, c) => s + c.quantity, 0);
                return (
                  <div key={section} style={dk.section}>
                    <div style={dk.sectionLabel}>{SECTION_LABELS[section]} ({total})</div>
                    {cards.map((c) => (
                      <div key={c.id} style={dk.cardRow}>
                        <span style={dk.qty}>{c.quantity}x</span>
                        <span style={dk.cardName}>{c.cardName}</span>
                        {c.isProxy && <span style={dk.proxyBadge}>PROXY</span>}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const dk: Record<string, React.CSSProperties> = {
  layout: { display: 'flex', gap: '16px', alignItems: 'flex-start', flexWrap: 'wrap' },
  playerList: { display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '180px' },
  playerBtn: { background: 'none', border: '1px solid #1e3a5f', color: '#94a3b8', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' },
  playerBtnActive: { backgroundColor: '#1e3a5f', color: '#e2e8f0', borderColor: '#38bdf8' },
  cardCount: { color: '#475569', fontSize: '12px', whiteSpace: 'nowrap' },
  deckView: { flex: 1, minWidth: '220px' },
  deckMeta: { color: '#475569', fontSize: '12px', marginBottom: '12px' },
  section: { marginBottom: '12px' },
  sectionLabel: { color: '#64748b', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' },
  cardRow: { display: 'flex', alignItems: 'center', gap: '6px', padding: '2px 0', borderBottom: '1px solid #0f1e2e' },
  qty: { color: '#64748b', fontSize: '12px', minWidth: '24px' },
  cardName: { color: '#cbd5e1', fontSize: '13px', flex: 1 },
  proxyBadge: { backgroundColor: '#2d1b4e', color: '#c084fc', fontSize: '10px', padding: '1px 6px', borderRadius: '999px' },
  noproxy: { color: '#fca5a5', backgroundColor: '#3b1c1c', border: '1px solid #ef4444', fontSize: '11px', padding: '2px 8px', borderRadius: '4px' },
  proxybadge: { color: '#86efac', backgroundColor: '#14291e', border: '1px solid #4ade80', fontSize: '11px', padding: '2px 8px', borderRadius: '4px' },
};

function DropdownItem({ label, onSelect }: { label: string; onSelect: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      style={{ ...pp.dropdownItem, ...(hovered ? pp.dropdownItemHover : {}) }}
      onMouseDown={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {label}
    </div>
  );
}

function PlayersPanel({ eventId, maxPlayers }: {
  eventId: number;
  maxPlayers: number;
}) {
  const [registrations, setRegistrations] = useState<RegistrationResponse[]>([]);
  const [allPlayers, setAllPlayers] = useState<PlayerResponse[]>([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const load = () => {
    Promise.all([getEventRegistrations(eventId), getPlayers()])
      .then(([regs, players]) => { setRegistrations(regs); setAllPlayers(players); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [eventId]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const registeredIds = new Set(registrations.map((r) => r.playerId));

  const filtered = allPlayers.filter((p) => {
    if (registeredIds.has(p.id)) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return p.username.toLowerCase().includes(q) || (p.nickname ?? '').toLowerCase().includes(q);
  });

  const handleSelect = async (player: PlayerResponse) => {
    setOpen(false);
    setSearch('');
    setError('');
    try {
      await adminRegisterPlayer(eventId, player.id);
      load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err?.response?.data?.message ?? 'Failed to register player.');
    }
  };

  const handleRemove = async (reg: RegistrationResponse) => {
    if (!confirm(`Remove ${reg.playerDisplayName} from this event?`)) return;
    setError('');
    try {
      await cancelRegistration(reg.id);
      load();
    } catch {
      setError('Failed to remove player.');
    }
  };

  if (loading) return <div style={panelStyles.hint}>Loading players...</div>;

  return (
    <div style={panelStyles.container}>
      <div style={panelStyles.header}>
        <div style={panelStyles.title}>
          Registered Players <span style={{ color: '#64748b', fontWeight: 400 }}>({registrations.length}/{maxPlayers})</span>
        </div>
      </div>

      {error && <div style={panelStyles.errorMsg}>{error}</div>}

      {/* Add player combobox */}
      <div style={pp.addRow} ref={dropdownRef}>
        <div style={pp.comboWrap}>
          <input
            ref={inputRef}
            style={pp.searchInput}
            placeholder="Search by name or nickname to add a player…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
          />
          {open && (
            <div style={pp.dropdown}>
              {filtered.length === 0 ? (
                <div style={pp.dropdownEmpty}>
                  {search.trim() ? 'No matching players.' : allPlayers.length === registrations.length ? 'All players are registered.' : 'No players found.'}
                </div>
              ) : (
                filtered.map((p) => (
                  <DropdownItem key={p.id} label={p.displayName} onSelect={() => handleSelect(p)} />
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Current registrations */}
      {registrations.length === 0 ? (
        <div style={panelStyles.hint}>No players registered yet.</div>
      ) : (
        <div style={pp.playerList}>
          {registrations.map((reg) => (
            <div key={reg.id} style={pp.playerRow}>
              <span style={pp.playerName}>{reg.playerDisplayName}</span>
              <button style={pp.removeBtn} onClick={() => handleRemove(reg)} title="Remove player">✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const pp: Record<string, React.CSSProperties> = {
  addRow: { position: 'relative', marginBottom: '16px' },
  comboWrap: { position: 'relative' },
  searchInput: { width: '100%', padding: '8px 12px', backgroundColor: '#0f1e2e', border: '1px solid #334155', borderRadius: '6px', color: '#e2e8f0', fontSize: '14px', boxSizing: 'border-box', outline: 'none' },
  dropdown: { position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: '#0d1f35', border: '1px solid #334155', borderRadius: '6px', marginTop: '4px', maxHeight: '220px', overflowY: 'auto', zIndex: 100, boxShadow: '0 8px 24px rgba(0,0,0,0.5)' },
  dropdownItem: { padding: '10px 14px', color: '#cbd5e1', fontSize: '14px', cursor: 'pointer', borderBottom: '1px solid #1e293b' },
  dropdownItemHover: { backgroundColor: '#1e3a5f', color: '#f1f5f9' },
  dropdownEmpty: { padding: '12px 14px', color: '#475569', fontSize: '13px' },
  playerList: { display: 'flex', flexDirection: 'column', gap: '6px' },
  playerRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#1a2035', borderRadius: '6px' },
  playerName: { color: '#cbd5e1', fontSize: '14px' },
  removeBtn: { background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: '16px', padding: '0 4px', lineHeight: 1 },
};

function formatStatus(status: string): string {
  if (status === 'InProgress') return 'In Progress';
  return status;
}

function getStatusStyle(status: string): React.CSSProperties {
  switch (status) {
    case 'Planning':   return { color: '#94a3b8', borderColor: '#94a3b8' };
    case 'Upcoming':   return { color: '#f59e0b', borderColor: '#f59e0b' };
    case 'InProgress': return { color: '#22c55e', borderColor: '#22c55e' };
    case 'Completed':  return { color: '#64748b', borderColor: '#64748b' };
    default:           return {};
  }
}

const styles: Record<string, React.CSSProperties> = {
  loading: { color: '#94a3b8', textAlign: 'center', padding: '40px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' },
  heading: { color: '#a855f7', margin: 0 },
  createBtn: { backgroundColor: '#a855f7', color: 'white', padding: '10px 20px', borderRadius: '4px', textDecoration: 'none', fontSize: '14px' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', color: '#94a3b8', padding: '10px', borderBottom: '1px solid #334155', fontSize: '13px' },
  td: { color: '#cbd5e1', padding: '10px', borderBottom: '1px solid #1e293b', fontSize: '14px', verticalAlign: 'top' },
  matchesTd: { padding: 0, borderBottom: '1px solid #1e293b' },
  statusBadge: { fontSize: '12px', border: '1px solid', borderRadius: '999px', padding: '2px 8px', display: 'inline-block' },
  pipeline: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '2px', marginTop: '6px' },
  pipelineSep: { color: '#475569', fontSize: '11px' },
  phaseChip: { fontSize: '11px', color: '#64748b', padding: '1px 6px', borderRadius: '3px', backgroundColor: '#1e293b' },
  phaseChipActive: { color: '#a855f7', backgroundColor: '#2d1b4e', fontWeight: 600 },
  phaseChipDone: { color: '#22c55e', backgroundColor: '#14291e' },
  advanceBtn: { background: 'none', border: '1px solid #a855f7', color: '#a855f7', cursor: 'pointer', fontSize: '12px', padding: '3px 8px', borderRadius: '4px', marginRight: '6px' },
  backBtn: { background: 'none', border: '1px solid #475569', color: '#64748b', cursor: 'pointer', fontSize: '12px', padding: '3px 8px', borderRadius: '4px', marginRight: '6px' },
  completeBtn: { background: 'none', border: '1px solid #22c55e', color: '#22c55e', cursor: 'pointer', fontSize: '12px', padding: '3px 8px', borderRadius: '4px', marginRight: '6px' },
  matchesBtn: { background: 'none', border: '1px solid #38bdf8', color: '#38bdf8', cursor: 'pointer', fontSize: '12px', padding: '3px 8px', borderRadius: '4px', marginRight: '6px' },
  matchesBtnActive: { backgroundColor: '#0c2a3a', color: '#7dd3fc' },
  editLink: { color: '#a855f7', textDecoration: 'none', marginRight: '8px', fontSize: '13px' },
  statusLink: { color: '#38bdf8', textDecoration: 'none', marginRight: '8px', fontSize: '13px', border: '1px solid #1e3a5f', padding: '3px 8px', borderRadius: '4px' },
  deleteBtn: { background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '13px', padding: 0 },
};

// ── TimerControl ──────────────────────────────────────────────────────────────

function TimerControl({ eventId, timerStartedAt, timerDurationSeconds, onTimerChange }: {
  eventId: number;
  timerStartedAt: string | null;
  timerDurationSeconds: number;
  onTimerChange: (updated: EventResponse) => void;
}) {
  const [minutes, setMinutes] = useState(Math.max(1, Math.round(timerDurationSeconds / 60)));
  const remaining = useTimer(timerStartedAt, timerDurationSeconds);
  const isRunning = timerStartedAt !== null;
  const isExpired = remaining !== null && remaining < 0;

  const handleStart = async () => {
    const secs = Math.max(1, minutes) * 60;
    const updated = await startTimer(eventId, secs);
    if (updated) onTimerChange(updated);
  };

  const handleStop = async () => {
    const updated = await stopTimer(eventId);
    if (updated) onTimerChange(updated);
  };

  return (
    <div style={tc.wrap}>
      <div style={tc.row}>
        <span style={tc.label}>Round Timer</span>

        {isRunning ? (
          <>
            <span style={{ ...tc.display, color: isExpired ? '#ef4444' : '#22c55e' }}>
              {remaining !== null ? formatTimer(remaining) : '--:--'}
            </span>
            <button style={tc.stopBtn} onClick={handleStop}>⏹ Stop</button>
          </>
        ) : (
          <>
            <div style={tc.inputGroup}>
              <input
                style={tc.input}
                type="number"
                min={1}
                max={999}
                value={minutes}
                onChange={(e) => setMinutes(Math.max(1, parseInt(e.target.value) || 1))}
              />
              <span style={tc.unit}>min</span>
            </div>
            <div style={tc.presets}>
              {[5, 15, 30, 60].map((m) => (
                <button key={m} style={{ ...tc.presetBtn, ...(minutes === m ? tc.presetBtnActive : {}) }} onClick={() => setMinutes(m)}>
                  {m}m
                </button>
              ))}
            </div>
            <button style={tc.startBtn} onClick={handleStart}>▶ Start</button>
          </>
        )}
      </div>
    </div>
  );
}

const tc: Record<string, React.CSSProperties> = {
  wrap: { backgroundColor: '#0f1e2e', border: '1px solid #1e3a5f', borderRadius: '6px', padding: '10px 14px', marginBottom: '14px' },
  row: { display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' },
  label: { color: '#64748b', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', minWidth: '90px' },
  display: { fontFamily: 'monospace', fontSize: '28px', fontWeight: 800, letterSpacing: '0.05em', minWidth: '90px' },
  inputGroup: { display: 'flex', alignItems: 'center', gap: '6px' },
  input: { width: '64px', padding: '6px 8px', backgroundColor: '#0f3460', border: '1px solid #334155', borderRadius: '4px', color: '#e2e8f0', fontSize: '16px', textAlign: 'center' },
  unit: { color: '#64748b', fontSize: '14px' },
  presets: { display: 'flex', gap: '4px' },
  presetBtn: { padding: '4px 10px', background: 'none', border: '1px solid #334155', color: '#64748b', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 },
  presetBtnActive: { borderColor: '#22c55e', color: '#22c55e', backgroundColor: '#0a1f12' },
  startBtn: { padding: '6px 16px', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 },
  stopBtn: { padding: '6px 16px', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 },
};

const panelStyles: Record<string, React.CSSProperties> = {
  container: { backgroundColor: '#0d1f35', padding: '20px 24px', borderTop: '1px solid #1e293b' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' },
  title: { color: '#e2e8f0', fontWeight: 600, fontSize: '14px', margin: 0 },
  feedback: { color: '#86efac', fontSize: '13px', marginBottom: '12px' },
  hint: { color: '#475569', fontSize: '13px' },
  section: { marginBottom: '20px' },
  sectionLabel: { color: '#64748b', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' },
  pendingRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', padding: '10px 0', borderBottom: '1px solid #1a2a3a' },
  completedRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #1a2a3a' },
  players: { color: '#cbd5e1', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' },
  vs: { color: '#475569', margin: '0 4px' },
  score: { color: '#a855f7', fontWeight: 600, margin: '0 8px', fontSize: '13px' },
  winner: { color: '#22c55e', fontWeight: 600 },
  byeBadge: { backgroundColor: '#1e3a5f', color: '#38bdf8', fontSize: '11px', padding: '1px 8px', borderRadius: '999px', marginLeft: '6px' },
  pts: { color: '#64748b', fontSize: '13px' },
  options: { display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' },
  inputLabel: { color: '#94a3b8', fontSize: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' },
  numInput: { width: '52px', padding: '4px 6px', backgroundColor: '#0f3460', border: '1px solid #334155', borderRadius: '4px', color: '#e2e8f0', fontSize: '14px', textAlign: 'center' },
  submitBtn: { padding: '6px 14px', backgroundColor: '#7c3aed', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', alignSelf: 'flex-end' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', color: '#64748b', padding: '6px 10px', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', borderBottom: '1px solid #1e293b' },
  td: { color: '#cbd5e1', padding: '6px 10px', fontSize: '13px', borderBottom: '1px solid #0f1e2e' },
  eliminatedRow: { opacity: 0.45 },
  elimBadge: { marginLeft: '8px', backgroundColor: '#3b1c1c', color: '#ef4444', fontSize: '10px', padding: '1px 6px', borderRadius: '999px' },
  dropBadge: { marginLeft: '8px', backgroundColor: '#1c1e2e', color: '#94a3b8', fontSize: '10px', padding: '1px 6px', borderRadius: '999px' },
  warnBadge: { marginLeft: '8px', backgroundColor: '#2d1e00', color: '#f59e0b', fontSize: '10px', padding: '1px 6px', borderRadius: '999px' },
  dropBtn: { background: 'none', border: '1px solid #475569', color: '#94a3b8', cursor: 'pointer', fontSize: '11px', padding: '2px 8px', borderRadius: '4px' },
  undropBtn: { background: 'none', border: '1px solid #38bdf8', color: '#38bdf8', cursor: 'pointer', fontSize: '11px', padding: '2px 8px', borderRadius: '4px' },
  nextRoundBtn: { padding: '5px 14px', backgroundColor: '#0ea5e9', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 },
  deletePairingBtn: { background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '16px', padding: '0 4px', alignSelf: 'flex-end', lineHeight: 1 },
  errorMsg: { color: '#f87171', backgroundColor: '#3b1c1c', border: '1px solid #ef4444', padding: '8px 12px', borderRadius: '4px', fontSize: '13px', marginBottom: '12px' },
  reopenBtn: { background: 'none', border: '1px solid #f59e0b', color: '#f59e0b', cursor: 'pointer', fontSize: '11px', padding: '2px 8px', borderRadius: '4px', marginLeft: '8px' },
};
