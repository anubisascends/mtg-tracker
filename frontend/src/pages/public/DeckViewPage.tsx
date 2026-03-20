import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import DeckGridView from '../../components/DeckGridView';
import type { DeckSubmissionResponse } from '../../api/decks';

// Raw axios (no auth interceptors) — this is a public endpoint
const publicGet = <T,>(url: string) =>
  axios.get<T>(url, { baseURL: '/api' }).then((r) => r.data);

export default function DeckViewPage() {
  const { eventId, playerId } = useParams<{ eventId: string; playerId: string }>();
  const [deck, setDeck] = useState<DeckSubmissionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    publicGet<DeckSubmissionResponse>(`/events/${eventId}/deck/view/${playerId}`)
      .then(setDeck)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [eventId, playerId]);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (loading) return <div style={s.centered}>Loading deck…</div>;
  if (notFound || !deck) return (
    <div style={s.centered}>
      <div style={{ fontSize: '32px', marginBottom: '12px' }}>🃏</div>
      <div style={{ color: '#94a3b8', marginBottom: '16px' }}>Deck not found or not yet submitted.</div>
      <Link to="/status" style={s.link}>← Event status</Link>
    </div>
  );

  const totalMain = deck.cards.filter((c) => c.section === 'MainDeck').reduce((n, c) => n + c.quantity, 0);
  const totalSide = deck.cards.filter((c) => c.section === 'Sideboard').reduce((n, c) => n + c.quantity, 0);
  const totalCmd  = deck.cards.filter((c) => c.section === 'Commander').reduce((n, c) => n + c.quantity, 0);
  const hasProxies = deck.cards.some((c) => c.isProxy);

  const stats: string[] = [];
  if (totalCmd  > 0) stats.push(`${totalCmd} commander`);
  if (totalMain > 0) stats.push(`${totalMain} main`);
  if (totalSide > 0) stats.push(`${totalSide} sideboard`);
  if (hasProxies)    stats.push('contains proxies');

  return (
    <div style={s.root}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <div style={s.playerName}>{deck.playerDisplayName}</div>
          <div style={s.stats}>{stats.join(' · ')}</div>
          <div style={s.updated}>
            Submitted {new Date(deck.submittedAt).toLocaleDateString()}
            {deck.updatedAt !== deck.submittedAt && (
              <> · Updated {new Date(deck.updatedAt).toLocaleDateString()}</>
            )}
          </div>
        </div>
        <button style={s.shareBtn} onClick={handleShare}>
          {copied ? '✓ Copied!' : '🔗 Share'}
        </button>
      </div>

      {/* Proxy legend */}
      {hasProxies && (
        <div style={s.proxyLegend}>
          <span style={s.proxyDot} /> Cards with a red glow are proxies
        </div>
      )}

      {/* Grid */}
      <DeckGridView cards={deck.cards} showProxyGlow />
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  root: {
    maxWidth: '900px', margin: '0 auto',
    padding: '20px 16px',
    backgroundColor: '#0d1b2a', minHeight: '100vh', color: '#e2e8f0',
  },
  centered: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    minHeight: '60vh', color: '#64748b', fontSize: '15px', textAlign: 'center',
  },
  link: { color: '#a855f7', textDecoration: 'none', fontSize: '14px' },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    gap: '12px', marginBottom: '20px', flexWrap: 'wrap',
  },
  headerLeft: { display: 'flex', flexDirection: 'column', gap: '4px' },
  playerName: { fontSize: '24px', fontWeight: 700, color: '#a855f7' },
  stats: { color: '#64748b', fontSize: '13px' },
  updated: { color: '#334155', fontSize: '12px' },
  shareBtn: {
    backgroundColor: '#1e293b', color: '#94a3b8',
    border: '1px solid #334155', borderRadius: '8px',
    padding: '8px 16px', cursor: 'pointer', fontSize: '13px',
    fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap',
  },
  proxyLegend: {
    display: 'flex', alignItems: 'center', gap: '8px',
    backgroundColor: '#1a0a0a', border: '1px solid #7f1d1d',
    borderRadius: '6px', padding: '8px 12px',
    color: '#fca5a5', fontSize: '12px', marginBottom: '20px',
  },
  proxyDot: {
    display: 'inline-block', width: '14px', height: '14px',
    borderRadius: '3px', flexShrink: 0,
    boxShadow: 'inset 0 0 0 2px rgba(239,68,68,0.9), 0 0 8px 2px rgba(239,68,68,0.6)',
    backgroundColor: 'transparent',
  },
};
