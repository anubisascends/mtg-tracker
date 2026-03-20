import { useState, useEffect, useRef } from 'react';
import { getCardByName, getCardImageUri } from '../api/scryfall';
import type { DeckCardResponse, DeckSection } from '../api/decks';

interface Props {
  cards: DeckCardResponse[];
  /** If true, proxy cards show a red glow. Always true when rendering for view. */
  showProxyGlow?: boolean;
}

const SECTION_ORDER: DeckSection[] = ['Commander', 'MainDeck', 'Sideboard'];
const SECTION_LABEL: Record<DeckSection, string> = {
  Commander: 'Commander',
  MainDeck: 'Main Deck',
  Sideboard: 'Sideboard',
};

export default function DeckGridView({ cards, showProxyGlow = true }: Props) {
  const sections = SECTION_ORDER.map((s) => ({
    key: s,
    label: SECTION_LABEL[s],
    cards: cards.filter((c) => c.section === s),
    total: cards.filter((c) => c.section === s).reduce((n, c) => n + c.quantity, 0),
  })).filter((s) => s.cards.length > 0);

  if (cards.length === 0) {
    return (
      <div style={gs.empty}>
        <div style={{ fontSize: '32px', marginBottom: '10px' }}>🃏</div>
        No cards in this deck.
      </div>
    );
  }

  return (
    <div style={gs.root}>
      {sections.map((sec) => (
        <div key={sec.key} style={gs.section}>
          <div style={gs.sectionHeader}>
            {sec.label}
            <span style={gs.sectionCount}>{sec.total}</span>
          </div>
          <div style={gs.grid}>
            {sec.cards.map((card, i) => (
              <CardTile key={i} card={card} showProxyGlow={showProxyGlow} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── CardTile ──────────────────────────────────────────────────────────────────
function CardTile({ card, showProxyGlow }: { card: DeckCardResponse; showProxyGlow: boolean }) {
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const fetchedRef = useRef(false);

  // Lazy-load: fetch image when tile scrolls into view
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !fetchedRef.current) {
          fetchedRef.current = true;
          getCardByName(card.cardName).then((sc) => {
            if (sc) setImgSrc(getCardImageUri(sc, 'normal'));
            else setError(true);
          }).catch(() => setError(true));
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [card.cardName]);

  const isProxy = card.isProxy && showProxyGlow;

  return (
    <div ref={ref} style={gt.wrap} title={card.cardName}>
      {/* Proxy glow overlay */}
      {isProxy && <div style={gt.proxyGlow} />}

      {/* Quantity badge */}
      {card.quantity > 1 && (
        <div style={gt.qtyBadge}>{card.quantity}×</div>
      )}

      {/* Proxy badge */}
      {card.isProxy && (
        <div style={gt.proxyBadge}>PROXY</div>
      )}

      {/* Card image */}
      {imgSrc && !error ? (
        <img
          src={imgSrc}
          alt={card.cardName}
          style={{ ...gt.img, opacity: loaded ? 1 : 0 }}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
        />
      ) : null}

      {/* Placeholder shown while loading or on error */}
      {(!imgSrc || !loaded || error) && (
        <div style={{ ...gt.placeholder, opacity: loaded ? 0 : 1 }}>
          <div style={gt.placeholderName}>{card.cardName}</div>
        </div>
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const gs: Record<string, React.CSSProperties> = {
  root: { display: 'flex', flexDirection: 'column', gap: '28px' },
  empty: { textAlign: 'center', color: '#475569', padding: '40px', fontSize: '14px' },
  section: {},
  sectionHeader: {
    display: 'flex', alignItems: 'center', gap: '8px',
    color: '#94a3b8', fontSize: '12px', fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.08em',
    marginBottom: '12px', paddingBottom: '6px',
    borderBottom: '1px solid #1e293b',
  },
  sectionCount: {
    backgroundColor: '#1e293b', color: '#64748b',
    borderRadius: '999px', padding: '1px 8px', fontSize: '11px', fontWeight: 600,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
    gap: '10px',
  },
};

const gt: Record<string, React.CSSProperties> = {
  wrap: {
    position: 'relative',
    borderRadius: '8px',
    overflow: 'hidden',
    aspectRatio: '0.716',   // standard MTG card ratio
    backgroundColor: '#0f1e2e',
    cursor: 'default',
  },
  proxyGlow: {
    position: 'absolute', inset: 0, zIndex: 3, borderRadius: '8px', pointerEvents: 'none',
    boxShadow: 'inset 0 0 0 3px rgba(239,68,68,0.9), 0 0 16px 4px rgba(239,68,68,0.6)',
  },
  qtyBadge: {
    position: 'absolute', top: '6px', left: '6px', zIndex: 4,
    backgroundColor: 'rgba(0,0,0,0.82)', color: '#f1f5f9',
    fontSize: '12px', fontWeight: 700, padding: '2px 7px',
    borderRadius: '999px', lineHeight: 1.4,
    border: '1px solid rgba(255,255,255,0.12)',
  },
  proxyBadge: {
    position: 'absolute', bottom: '6px', left: '50%', transform: 'translateX(-50%)', zIndex: 4,
    backgroundColor: 'rgba(239,68,68,0.85)', color: '#fff',
    fontSize: '9px', fontWeight: 700, padding: '2px 7px',
    borderRadius: '999px', letterSpacing: '0.06em', whiteSpace: 'nowrap',
  },
  img: {
    position: 'absolute', inset: 0, width: '100%', height: '100%',
    objectFit: 'cover', transition: 'opacity 0.25s',
  },
  placeholder: {
    position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '8px', transition: 'opacity 0.2s',
  },
  placeholderName: {
    color: '#475569', fontSize: '11px', textAlign: 'center',
    lineHeight: 1.3, wordBreak: 'break-word',
  },
};
