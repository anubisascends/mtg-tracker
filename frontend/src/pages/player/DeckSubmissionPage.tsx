import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getEvent, EventResponse } from '../../api/events';
import { getMyDeck, submitDeck, DeckCardRequest, DeckSubmissionResponse } from '../../api/decks';
import { getMyDecks, PlayerDeckResponse } from '../../api/playerDecks';
import { autocomplete, getCardByName, getCardImageUri, ScryfallCard } from '../../api/scryfall';
import { useAuth } from '../../context/AuthContext';
import DeckGridView from '../../components/DeckGridView';

type Section = 'MainDeck' | 'Sideboard' | 'Commander';
const SECTION_NUM: Record<Section, number> = { MainDeck: 0, Sideboard: 1, Commander: 2 };

interface LocalCard {
  cardName: string;
  quantity: number;
  section: Section;
  isProxy: boolean;
  scryfallData?: ScryfallCard | null;
}

// ── Decklist text parser ──────────────────────────────────────────────────────
// Handles: Arena, MTGO, Moxfield, plain "4 Card Name" formats
function parseDeckText(text: string): LocalCard[] {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  let section: Section = 'MainDeck';
  const cards: LocalCard[] = [];

  for (const line of lines) {
    if (/^(commander|companion)$/i.test(line)) { section = 'Commander'; continue; }
    if (/^(deck|main( deck)?|mainboard)$/i.test(line)) { section = 'MainDeck'; continue; }
    if (/^(sideboard|sb|sb:|\/\/sideboard)/i.test(line)) { section = 'Sideboard'; continue; }
    if (line.startsWith('//')) continue;

    // Match "4 Card Name (SET) 123" or "4x Card Name" or plain "Card Name"
    const m = line.match(/^(\d+)x?\s+(.+?)(?:\s+\([A-Z0-9]+\)\s*\d*)?$/i);
    if (m) {
      const qty = parseInt(m[1]);
      const name = m[2].replace(/\s*\/\/.*$/, '').trim();
      if (name && qty > 0) cards.push({ cardName: name, quantity: qty, section, isProxy: false });
    } else {
      // Plain card name with no quantity
      const name = line.replace(/\s*\([A-Z0-9]+\)\s*\d*$/i, '').replace(/\s*\/\/.*$/, '').trim();
      if (name) cards.push({ cardName: name, quantity: 1, section, isProxy: false });
    }
  }
  return cards;
}

// ── Merge helper: combine parsed cards into existing list ─────────────────────
function mergeCards(existing: LocalCard[], incoming: LocalCard[]): LocalCard[] {
  const result = [...existing];
  for (const card of incoming) {
    const idx = result.findIndex(
      (c) => c.cardName.toLowerCase() === card.cardName.toLowerCase() && c.section === card.section,
    );
    if (idx >= 0) {
      result[idx] = { ...result[idx], quantity: result[idx].quantity + card.quantity };
    } else {
      result.push(card);
    }
  }
  return result;
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DeckSubmissionPage() {
  const { id } = useParams<{ id: string }>();
  const eventId = parseInt(id!);
  const { user } = useAuth();

  const [event, setEvent] = useState<EventResponse | null>(null);
  const [existing, setExisting] = useState<DeckSubmissionResponse | null>(null);
  const [cards, setCards] = useState<LocalCard[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [saveError, setSaveError] = useState('');
  const [loading, setLoading] = useState(true);
  const [savedDecks, setSavedDecks] = useState<PlayerDeckResponse[]>([]);
  const [loadDeckId, setLoadDeckId] = useState<string>('');

  // View mode: 'edit' shows card list, 'grid' shows image grid
  const [viewMode, setViewMode] = useState<'edit' | 'grid'>('edit');

  // Left panel tab
  const [tab, setTab] = useState<'search' | 'import'>('search');

  // Search tab state
  const [search, setSearch] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const [selectedCard, setSelectedCard] = useState<ScryfallCard | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [addQty, setAddQty] = useState(1);
  const [addSection, setAddSection] = useState<Section>('MainDeck');
  const [addProxy, setAddProxy] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [dropOpen, setDropOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Import tab state
  const [importText, setImportText] = useState('');
  const [importPreview, setImportPreview] = useState<LocalCard[] | null>(null);
  const [importProxyAll, setImportProxyAll] = useState(false);

  useEffect(() => {
    Promise.all([
      getEvent(eventId),
      getMyDeck(eventId).catch(() => null),
      getMyDecks().catch(() => []),
    ]).then(([ev, deck, myDecks]) => {
      setEvent(ev);
      setSavedDecks(myDecks);
      if (deck) {
        setExisting(deck);
        setCards(
          deck.cards.map((c) => ({
            cardName: c.cardName,
            quantity: c.quantity,
            section: c.section,
            isProxy: c.isProxy,
          })),
        );
      }
      if (ev.format === 'Commander') setAddSection('Commander');
    }).finally(() => setLoading(false));
  }, [eventId]);

  const handleLoadSavedDeck = () => {
    const deck = savedDecks.find((d) => d.id === parseInt(loadDeckId));
    if (!deck) return;
    if (cards.length > 0 && !confirm('This will replace your current cards with the saved deck. Continue?')) return;
    setCards(deck.cards.map((c) => ({
      cardName: c.cardName,
      quantity: c.quantity,
      section: c.section,
      isProxy: c.isProxy,
    })));
    setLoadDeckId('');
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setDropOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Search handlers ──────────────────────────────────────────────────────────
  const handleSearchChange = (val: string) => {
    setSearch(val);
    setSelectedCard(null);
    setPreview(null);
    setHighlightIdx(-1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.trim().length < 2) { setSuggestions([]); setDropOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      const results = await autocomplete(val);
      setSuggestions(results.slice(0, 12));
      setDropOpen(results.length > 0);
      setHighlightIdx(-1);
    }, 300);
  };

  const selectSuggestion = async (name: string) => {
    setSearch(name);
    setDropOpen(false);
    setSuggestions([]);
    setHighlightIdx(-1);
    setSearchLoading(true);
    const card = await getCardByName(name);
    setSelectedCard(card);
    setPreview(card ? getCardImageUri(card, 'normal') : null);
    setSearchLoading(false);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (!dropOpen || suggestions.length === 0) {
      if (e.key === 'Enter' && selectedCard) { handleAddCard(); e.preventDefault(); }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const name = highlightIdx >= 0 ? suggestions[highlightIdx] : suggestions[0];
      selectSuggestion(name);
    } else if (e.key === 'Escape') {
      setDropOpen(false);
    }
  };

  const handleAddCard = () => {
    if (!selectedCard) return;
    setCards((prev) => {
      const hit = prev.find(
        (c) => c.cardName.toLowerCase() === selectedCard.name.toLowerCase() && c.section === addSection,
      );
      if (hit) {
        return prev.map((c) =>
          c === hit ? { ...c, quantity: c.quantity + addQty, isProxy: addProxy } : c,
        );
      }
      return [...prev, {
        cardName: selectedCard.name,
        quantity: addQty,
        section: addSection,
        isProxy: addProxy,
        scryfallData: selectedCard,
      }];
    });
    setSearch('');
    setSelectedCard(null);
    setPreview(null);
    setAddQty(1);
    setAddProxy(false);
  };

  // ── Import handlers ──────────────────────────────────────────────────────────
  const handleParseImport = () => {
    const parsed = parseDeckText(importText);
    setImportPreview(parsed);
  };

  const handleConfirmImport = () => {
    if (!importPreview) return;
    const toImport = importProxyAll ? importPreview.map((c) => ({ ...c, isProxy: true })) : importPreview;
    setCards((prev) => mergeCards(prev, toImport));
    setImportText('');
    setImportPreview(null);
    setImportProxyAll(false);
    setTab('search');
  };

  const handleReplaceWithImport = () => {
    if (!importPreview) return;
    const toImport = importProxyAll ? importPreview.map((c) => ({ ...c, isProxy: true })) : importPreview;
    setCards(toImport);
    setImportText('');
    setImportPreview(null);
    setImportProxyAll(false);
    setTab('search');
  };

  // ── Card list handlers ───────────────────────────────────────────────────────
  const handleRemoveCard = (idx: number) => setCards((p) => p.filter((_, i) => i !== idx));
  const handleQtyChange = (idx: number, qty: number) =>
    setCards((p) => p.map((c, i) => (i === idx ? { ...c, quantity: Math.max(1, qty) } : c)));
  const handleProxyToggle = (idx: number) =>
    setCards((p) => p.map((c, i) => (i === idx ? { ...c, isProxy: !c.isProxy } : c)));

  // ── Save ──────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (cards.length === 0) { setSaveError('Add at least one card before saving.'); return; }

    const format = event?.format ?? '';
    const isLimited   = format === 'Draft' || format === 'Sealed';
    const isCommander = format === 'Commander';
    const BASIC_LANDS = new Set(['Plains','Island','Swamp','Mountain','Forest','Wastes',
      'Snow-Covered Plains','Snow-Covered Island','Snow-Covered Swamp',
      'Snow-Covered Mountain','Snow-Covered Forest','Snow-Covered Wastes']);

    const mainCount      = cards.filter((c) => c.section === 'MainDeck').reduce((s, c) => s + c.quantity, 0);
    const sideboardCount = cards.filter((c) => c.section === 'Sideboard').reduce((s, c) => s + c.quantity, 0);
    const commanderCount = cards.filter((c) => c.section === 'Commander').reduce((s, c) => s + c.quantity, 0);

    if (isCommander) {
      if (commanderCount === 0) { setSaveError('Commander decks require at least one card in the Commander zone.'); return; }
      if (mainCount + commanderCount < 100) { setSaveError(`Commander decks must have 100 cards (commander included). You have ${mainCount + commanderCount}.`); return; }
      const counts = new Map<string, number>();
      for (const c of cards) {
        if (BASIC_LANDS.has(c.cardName)) continue;
        counts.set(c.cardName, (counts.get(c.cardName) ?? 0) + c.quantity);
      }
      for (const [name, qty] of counts) {
        if (qty > 1) { setSaveError(`Commander is singleton — '${name}' appears ${qty} times (max 1).`); return; }
      }
    } else {
      const minMain = isLimited ? 40 : 60;
      if (mainCount < minMain) { setSaveError(`Main deck must have at least ${minMain} cards. You have ${mainCount}.`); return; }
      if (sideboardCount > 15) { setSaveError(`Sideboard cannot exceed 15 cards. You have ${sideboardCount}.`); return; }
      const counts = new Map<string, number>();
      for (const c of cards) {
        if (BASIC_LANDS.has(c.cardName)) continue;
        counts.set(c.cardName, (counts.get(c.cardName) ?? 0) + c.quantity);
      }
      for (const [name, qty] of counts) {
        if (qty > 4) { setSaveError(`'${name}' appears ${qty} times. Maximum 4 copies allowed.`); return; }
      }
    }

    setSaving(true);
    setSaveMsg('');
    setSaveError('');
    try {
      const payload: DeckCardRequest[] = cards.map((c) => ({
        cardName: c.cardName,
        quantity: c.quantity,
        section: SECTION_NUM[c.section],
        isProxy: c.isProxy,
      }));
      const result = await submitDeck(eventId, payload);
      setExisting(result);
      setSaveMsg('Deck saved!');
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setSaveError(err?.response?.data?.message ?? 'Failed to save deck.');
    } finally {
      setSaving(false);
    }
  };

  // ── Render guards ─────────────────────────────────────────────────────────────
  if (loading) return <div style={s.loading}>Loading…</div>;
  if (!event) return <div style={s.loading}>Event not found.</div>;
  if (!event.requiresDeckRegistration) return (
    <div style={s.loading}>
      This event does not require deck registration.{' '}
      <Link to={`/events/${eventId}`} style={{ color: '#a855f7' }}>Back to event</Link>
    </div>
  );

  const mainDeck  = cards.filter((c) => c.section === 'MainDeck');
  const sideboard = cards.filter((c) => c.section === 'Sideboard');
  const commander = cards.filter((c) => c.section === 'Commander');
  const totalMain = mainDeck.reduce((n, c) => n + c.quantity, 0);
  const totalSide = sideboard.reduce((n, c) => n + c.quantity, 0);
  const totalCmd  = commander.reduce((n, c) => n + c.quantity, 0);
  const totalAll  = totalMain + totalSide + totalCmd;
  const hasProxies = cards.some((c) => c.isProxy);

  // Import preview stats
  const ipMain = importPreview?.filter((c) => c.section === 'MainDeck').reduce((n, c) => n + c.quantity, 0) ?? 0;
  const ipSide = importPreview?.filter((c) => c.section === 'Sideboard').reduce((n, c) => n + c.quantity, 0) ?? 0;
  const ipCmd  = importPreview?.filter((c) => c.section === 'Commander').reduce((n, c) => n + c.quantity, 0) ?? 0;

  return (
    <div style={s.root}>
      {/* ── Header ── */}
      <div style={s.header}>
        <div>
          <Link to={`/events/${eventId}`} style={s.back}>← {event.name}</Link>
          <h1 style={s.title}>Deck Registration</h1>
          <p style={s.meta}>{event.format} · {event.proxiesAllowed ? 'Proxies allowed' : 'No proxies'}</p>
        </div>
        <div style={s.headerRight}>
          {existing && (
            <div style={s.savedBadge}>
              On file · {new Date(existing.updatedAt).toLocaleString()}
            </div>
          )}
              {event.proxiesAllowed
            ? <div style={s.proxyBanner}>Proxies are <strong>allowed</strong> in this event.</div>
            : <div style={s.noProxyBanner}>Proxies are <strong>not allowed</strong> in this event.</div>}
        </div>
      </div>

      {/* ── Load from saved deck ── */}
      {savedDecks.length > 0 && (
        <div style={s.loadPanel}>
          <span style={s.loadLabel}>Load from a saved deck:</span>
          <select
            style={s.loadSelect}
            value={loadDeckId}
            onChange={(e) => setLoadDeckId(e.target.value)}
          >
            <option value="">— choose a deck —</option>
            {savedDecks.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}{d.format ? ` (${d.format})` : ''} · {d.totalCards} cards
              </option>
            ))}
          </select>
          <button
            style={{ ...s.loadBtn, ...(loadDeckId === '' ? s.loadBtnDisabled : {}) }}
            onClick={handleLoadSavedDeck}
            disabled={loadDeckId === ''}
          >
            Load Deck
          </button>
          <Link to="/my-decks" style={s.manageLink}>Manage decks ↗</Link>
        </div>
      )}
      {savedDecks.length === 0 && (
        <div style={s.loadPanel}>
          <span style={s.loadLabel}>No saved decks yet.</span>
          <Link to="/my-decks" style={s.manageLink}>Build one in My Decks ↗</Link>
        </div>
      )}

      <div style={s.layout}>
        {/* ── Left panel: search + import ── */}
        <div style={s.leftPanel}>
          {/* Tab switcher */}
          <div style={s.tabs}>
            <button
              style={{ ...s.tab, ...(tab === 'search' ? s.tabActive : {}) }}
              onClick={() => setTab('search')}
            >
              Search & Add
            </button>
            <button
              style={{ ...s.tab, ...(tab === 'import' ? s.tabActive : {}) }}
              onClick={() => setTab('import')}
            >
              Paste Import
            </button>
          </div>

          {/* ── Search tab ── */}
          {tab === 'search' && (
            <div>
              <div style={{ position: 'relative', marginBottom: '12px' }} ref={searchRef}>
                <input
                  style={s.input}
                  placeholder="Type a card name…"
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onFocus={() => suggestions.length > 0 && setDropOpen(true)}
                  onKeyDown={handleSearchKeyDown}
                  autoComplete="off"
                />
                {dropOpen && suggestions.length > 0 && (
                  <div style={s.dropdown}>
                    {suggestions.map((name, i) => (
                      <div
                        key={name}
                        style={{ ...s.dropItem, ...(i === highlightIdx ? s.dropItemActive : {}) }}
                        onMouseDown={() => selectSuggestion(name)}
                        onMouseEnter={() => setHighlightIdx(i)}
                      >
                        {name}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {searchLoading && <div style={s.hint}>Loading card info…</div>}

              {preview && selectedCard && (
                <div style={s.previewWrap}>
                  <img src={preview} alt={selectedCard.name} style={s.cardImg} />
                  <div style={s.cardMeta}>
                    <div style={s.cardName}>{selectedCard.name}</div>
                    {selectedCard.mana_cost && <div style={s.cardDetail}>{selectedCard.mana_cost}</div>}
                    {selectedCard.type_line && <div style={s.cardDetail}>{selectedCard.type_line}</div>}
                  </div>
                </div>
              )}

              {selectedCard && (
                <div style={s.addControls}>
                  <div style={s.addRow}>
                    <label style={s.addLabel}>Qty</label>
                    <input
                      style={{ ...s.input, width: '64px' }}
                      type="number"
                      min={1}
                      max={99}
                      value={addQty}
                      onChange={(e) => setAddQty(Math.max(1, parseInt(e.target.value) || 1))}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddCard(); }}
                    />
                  </div>
                  <div style={s.addRow}>
                    <label style={s.addLabel}>Section</label>
                    <select style={s.input} value={addSection} onChange={(e) => setAddSection(e.target.value as Section)}>
                      <option value="MainDeck">Main Deck</option>
                      <option value="Sideboard">Sideboard</option>
                      <option value="Commander">Commander</option>
                    </select>
                  </div>
                  {event.proxiesAllowed && (
                    <label style={s.checkLabel}>
                      <input
                        type="checkbox"
                        checked={addProxy}
                        onChange={(e) => setAddProxy(e.target.checked)}
                        style={{ accentColor: '#a855f7' }}
                      />
                      Mark as proxy
                    </label>
                  )}
                  <button style={s.addBtn} onClick={handleAddCard}>
                    Add to Deck
                    <span style={s.addHint}>or press Enter</span>
                  </button>
                </div>
              )}

              {!selectedCard && !searchLoading && (
                <p style={s.searchHint}>
                  Search for a card by name. Use ↑ ↓ to navigate suggestions, Enter to select.
                </p>
              )}
            </div>
          )}

          {/* ── Import tab ── */}
          {tab === 'import' && (
            <div>
              <p style={s.importHint}>
                Paste a decklist in any standard format — MTG Arena, MTGO, Moxfield, or plain text.
              </p>
              <div style={s.importExample}>
                <span style={s.exampleLabel}>Example:</span>
                <pre style={s.example}>{`Commander\n1 Atraxa, Praetors' Voice\n\nDeck\n4 Lightning Bolt\n20 Island\n\nSideboard\n2 Mystical Dispute`}</pre>
              </div>
              <textarea
                style={s.textarea}
                placeholder="Paste your decklist here…"
                value={importText}
                onChange={(e) => { setImportText(e.target.value); setImportPreview(null); }}
                rows={12}
                spellCheck={false}
              />

              {event.proxiesAllowed && (
                <label style={{ ...s.checkLabel, marginBottom: '10px' }}>
                  <input
                    type="checkbox"
                    checked={importProxyAll}
                    onChange={(e) => setImportProxyAll(e.target.checked)}
                    style={{ accentColor: '#a855f7' }}
                  />
                  Mark all imported cards as proxies
                </label>
              )}

              <button
                style={s.parseBtn}
                onClick={handleParseImport}
                disabled={importText.trim().length === 0}
              >
                Preview Import
              </button>

              {importPreview && (
                <div style={s.importPreview}>
                  <div style={s.importStats}>
                    Parsed <strong style={{ color: '#e2e8f0' }}>{importPreview.length}</strong> unique cards —{' '}
                    {ipMain > 0 && <span>{ipMain} main</span>}
                    {ipSide > 0 && <span> · {ipSide} side</span>}
                    {ipCmd  > 0 && <span> · {ipCmd} commander</span>}
                  </div>
                  <div style={s.importPreviewList}>
                    {importPreview.map((c, i) => (
                      <div key={i} style={s.importRow}>
                        <span style={s.importQty}>{c.quantity}x</span>
                        <span style={s.importName}>{c.cardName}</span>
                        <span style={s.importSection}>{c.section === 'MainDeck' ? 'Main' : c.section === 'Sideboard' ? 'Side' : 'Cmd'}</span>
                      </div>
                    ))}
                  </div>
                  <div style={s.importActions}>
                    {cards.length > 0 ? (
                      <>
                        <button style={s.importMergeBtn} onClick={handleConfirmImport}>Merge with current deck</button>
                        <button style={s.importReplaceBtn} onClick={handleReplaceWithImport}>Replace current deck</button>
                      </>
                    ) : (
                      <button style={s.importMergeBtn} onClick={handleConfirmImport}>Import</button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Right panel: deck list ── */}
        <div style={s.deckPanel}>
          <div style={s.deckHeader}>
            <div>
              <span style={s.deckTitle}>Your Deck</span>
              {totalAll > 0 && (
                <span style={s.deckStats}>
                  {totalMain > 0 && `${totalMain} main`}
                  {totalSide > 0 && ` · ${totalSide} side`}
                  {totalCmd  > 0 && ` · ${totalCmd} cmd`}
                  {hasProxies && ' · has proxies'}
                </span>
              )}
            </div>
            <div style={s.deckActions}>
              {cards.length > 0 && (
                <>
                  {/* View toggle */}
                  <div style={s.viewToggle}>
                    <button
                      style={{ ...s.toggleBtn, ...(viewMode === 'edit' ? s.toggleBtnActive : {}) }}
                      onClick={() => setViewMode('edit')}
                      title="List view"
                    >
                      ☰ List
                    </button>
                    <button
                      style={{ ...s.toggleBtn, ...(viewMode === 'grid' ? s.toggleBtnActive : {}) }}
                      onClick={() => setViewMode('grid')}
                      title="Grid view"
                    >
                      ⊞ Grid
                    </button>
                  </div>
                  {/* Share link — only available after deck is saved */}
                  {existing && user && (
                    <Link
                      to={`/events/${eventId}/deck/view/${user.userId}`}
                      target="_blank"
                      style={s.showBtn}
                      title="Open shareable deck view"
                    >
                      Show Deck ↗
                    </Link>
                  )}
                  <button style={s.clearBtn} onClick={() => { if (confirm('Clear entire deck?')) setCards([]); }}>
                    Clear
                  </button>
                </>
              )}
            </div>
          </div>

          {cards.length === 0 ? (
            <div style={s.emptyDeck}>
              <div style={s.emptyIcon}>🃏</div>
              <div>No cards yet.</div>
              <div style={{ fontSize: '13px', marginTop: '4px', color: '#334155' }}>
                Search for a card or use Paste Import to add your whole list at once.
              </div>
            </div>
          ) : viewMode === 'grid' ? (
            /* ── Grid view ── */
            <DeckGridView
              cards={cards.map((c, id) => ({
                id,
                cardName: c.cardName,
                quantity: c.quantity,
                section: c.section,
                isProxy: c.isProxy,
              }))}
              showProxyGlow={event.proxiesAllowed}
            />
          ) : (
            /* ── List view ── */
            <>
              {commander.length > 0 && (
                <CardSection
                  label="Commander"
                  cards={commander}
                  allCards={cards}
                  proxiesAllowed={event.proxiesAllowed}
                  onRemove={handleRemoveCard}
                  onQtyChange={handleQtyChange}
                  onProxyToggle={handleProxyToggle}
                />
              )}
              {mainDeck.length > 0 && (
                <CardSection
                  label={`Main Deck · ${totalMain}`}
                  cards={mainDeck}
                  allCards={cards}
                  proxiesAllowed={event.proxiesAllowed}
                  onRemove={handleRemoveCard}
                  onQtyChange={handleQtyChange}
                  onProxyToggle={handleProxyToggle}
                />
              )}
              {sideboard.length > 0 && (
                <CardSection
                  label={`Sideboard · ${totalSide}`}
                  cards={sideboard}
                  allCards={cards}
                  proxiesAllowed={event.proxiesAllowed}
                  onRemove={handleRemoveCard}
                  onQtyChange={handleQtyChange}
                  onProxyToggle={handleProxyToggle}
                />
              )}
            </>
          )}

          {/* Save */}
          <div style={s.saveRow}>
            {saveMsg   && <div style={s.successMsg}>{saveMsg}</div>}
            {saveError && <div style={s.errorMsg}>{saveError}</div>}
            <button
              style={{ ...s.saveBtn, ...(saving ? s.saveBtnDisabled : {}) }}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving…' : existing ? 'Update Deck' : 'Submit Deck'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── CardSection ───────────────────────────────────────────────────────────────
function CardSection({ label, cards, allCards, proxiesAllowed, onRemove, onQtyChange, onProxyToggle }: {
  label: string;
  cards: LocalCard[];
  allCards: LocalCard[];
  proxiesAllowed: boolean;
  onRemove: (i: number) => void;
  onQtyChange: (i: number, q: number) => void;
  onProxyToggle: (i: number) => void;
}) {
  return (
    <div style={cs.section}>
      <div style={cs.sectionLabel}>{label}</div>
      {cards.map((card) => {
        const realIdx = allCards.indexOf(card);
        return (
          <CardRow
            key={realIdx}
            card={card}
            idx={realIdx}
            proxiesAllowed={proxiesAllowed}
            onRemove={onRemove}
            onQtyChange={onQtyChange}
            onProxyToggle={onProxyToggle}
          />
        );
      })}
    </div>
  );
}

// ── CardRow ───────────────────────────────────────────────────────────────────
function CardRow({ card, idx, proxiesAllowed, onRemove, onQtyChange, onProxyToggle }: {
  card: LocalCard;
  idx: number;
  proxiesAllowed: boolean;
  onRemove: (i: number) => void;
  onQtyChange: (i: number, q: number) => void;
  onProxyToggle: (i: number) => void;
}) {
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [hovered, setHovered] = useState(false);

  const handleHover = async () => {
    if (imgSrc) return;
    const sc = card.scryfallData ?? await getCardByName(card.cardName);
    if (sc) setImgSrc(getCardImageUri(sc, 'normal'));
  };

  return (
    <div
      style={{ ...cs.row, ...(card.isProxy ? cs.proxyRow : {}) }}
      onMouseEnter={() => { setHovered(true); handleHover(); }}
      onMouseLeave={() => setHovered(false)}
    >
      {hovered && imgSrc && (
        <div style={cs.tooltip}>
          <img src={imgSrc} alt={card.cardName} style={cs.tooltipImg} />
        </div>
      )}

      <input
        style={cs.qtyInput}
        type="number"
        min={1}
        max={99}
        value={card.quantity}
        onChange={(e) => onQtyChange(idx, parseInt(e.target.value) || 1)}
      />
      <span style={{ ...cs.name, color: card.isProxy ? '#f59e0b' : '#e2e8f0' }}>
        {card.cardName}
        {card.isProxy && <span style={cs.proxyBadge}>PROXY</span>}
      </span>
      {proxiesAllowed && (
        <label style={cs.proxyToggle} title={card.isProxy ? 'Remove proxy' : 'Mark as proxy'}>
          <input
            type="checkbox"
            checked={card.isProxy}
            onChange={() => onProxyToggle(idx)}
            style={{ accentColor: '#f59e0b', cursor: 'pointer' }}
          />
        </label>
      )}
      <button style={cs.removeBtn} onClick={() => onRemove(idx)} title="Remove">✕</button>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s: Record<string, React.CSSProperties> = {
  root: { maxWidth: '1100px' },
  loading: { color: '#94a3b8', textAlign: 'center', padding: '40px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' },
  back: { color: '#64748b', textDecoration: 'none', fontSize: '13px' },
  title: { color: '#a855f7', margin: '4px 0', fontSize: '22px' },
  meta: { color: '#64748b', fontSize: '13px', margin: 0 },
  headerRight: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' },
  savedBadge: { backgroundColor: '#14291e', color: '#4ade80', border: '1px solid #22c55e', borderRadius: '6px', padding: '5px 12px', fontSize: '12px' },
  noProxyBanner: { backgroundColor: '#3b1c1c', color: '#fca5a5', border: '1px solid #ef4444', padding: '8px 14px', borderRadius: '6px', fontSize: '13px' },
  proxyBanner: { backgroundColor: '#14291e', color: '#86efac', border: '1px solid #22c55e', padding: '8px 14px', borderRadius: '6px', fontSize: '13px' },
  loadPanel: { display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#0f1e2e', border: '1px solid #1e3a5f', borderRadius: '8px', padding: '10px 14px', marginBottom: '20px', flexWrap: 'wrap' },
  loadLabel: { color: '#64748b', fontSize: '13px', flexShrink: 0 },
  loadSelect: { flex: 1, minWidth: '200px', padding: '6px 10px', backgroundColor: '#0f3460', border: '1px solid #334155', borderRadius: '6px', color: '#e2e8f0', fontSize: '13px', outline: 'none' },
  loadBtn: { padding: '6px 16px', backgroundColor: '#0ea5e9', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, flexShrink: 0 },
  loadBtnDisabled: { opacity: 0.4, cursor: 'not-allowed' },
  manageLink: { color: '#64748b', fontSize: '12px', textDecoration: 'none', flexShrink: 0 },
  layout: { display: 'grid', gridTemplateColumns: '340px 1fr', gap: '20px', alignItems: 'start' },
  leftPanel: { backgroundColor: '#16213e', border: '1px solid #1e293b', borderRadius: '10px', overflow: 'hidden' },
  tabs: { display: 'flex', borderBottom: '1px solid #1e293b' },
  tab: { flex: 1, padding: '10px', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '13px', fontWeight: 600 },
  tabActive: { color: '#a855f7', borderBottom: '2px solid #a855f7', marginBottom: '-1px', backgroundColor: '#0f1e2e' },
  input: { width: '100%', padding: '8px 10px', backgroundColor: '#0f3460', border: '1px solid #334155', borderRadius: '6px', color: '#e2e8f0', fontSize: '13px', boxSizing: 'border-box', outline: 'none' },
  dropdown: { position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: '#0d1f35', border: '1px solid #334155', borderRadius: '6px', marginTop: '4px', maxHeight: '220px', overflowY: 'auto', zIndex: 100, boxShadow: '0 8px 24px rgba(0,0,0,0.6)' },
  dropItem: { padding: '9px 12px', color: '#cbd5e1', fontSize: '13px', cursor: 'pointer', borderBottom: '1px solid #1e293b' },
  dropItemActive: { backgroundColor: '#1e3a5f', color: '#f1f5f9' },
  hint: { color: '#475569', fontSize: '12px', marginBottom: '8px' },
  searchHint: { color: '#334155', fontSize: '12px', textAlign: 'center', padding: '20px 0 8px', margin: 0 },
  previewWrap: { display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: '14px' },
  cardImg: { width: '90px', borderRadius: '8px', flexShrink: 0, boxShadow: '0 4px 12px rgba(0,0,0,0.5)' },
  cardMeta: { flex: 1, minWidth: 0 },
  cardName: { color: '#e2e8f0', fontWeight: 700, fontSize: '14px', marginBottom: '4px' },
  cardDetail: { color: '#64748b', fontSize: '12px', marginBottom: '2px' },
  addControls: { borderTop: '1px solid #1e293b', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' },
  addRow: { display: 'flex', alignItems: 'center', gap: '8px' },
  addLabel: { color: '#94a3b8', fontSize: '13px', minWidth: '52px', flexShrink: 0 },
  checkLabel: { display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '13px', cursor: 'pointer' },
  addBtn: { backgroundColor: '#a855f7', color: 'white', border: 'none', borderRadius: '6px', padding: '10px 16px', cursor: 'pointer', fontWeight: 700, fontSize: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  addHint: { color: 'rgba(255,255,255,0.4)', fontSize: '11px', fontWeight: 400 },
  importHint: { color: '#64748b', fontSize: '13px', marginBottom: '10px', marginTop: 0 },
  importExample: { backgroundColor: '#0a1525', border: '1px solid #1e293b', borderRadius: '6px', padding: '10px 12px', marginBottom: '12px' },
  exampleLabel: { color: '#475569', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: '6px' },
  example: { color: '#64748b', fontSize: '11px', margin: 0, whiteSpace: 'pre', fontFamily: 'monospace' },
  textarea: { width: '100%', padding: '10px', backgroundColor: '#0a1525', border: '1px solid #334155', borderRadius: '6px', color: '#cbd5e1', fontSize: '13px', fontFamily: 'monospace', resize: 'vertical', boxSizing: 'border-box', outline: 'none', display: 'block', marginBottom: '10px' },
  parseBtn: { width: '100%', padding: '9px', backgroundColor: '#0ea5e9', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '13px', marginBottom: '12px' },
  importPreview: { backgroundColor: '#0a1525', border: '1px solid #1e3a5f', borderRadius: '6px', padding: '12px' },
  importStats: { color: '#64748b', fontSize: '13px', marginBottom: '10px' },
  importPreviewList: { maxHeight: '200px', overflowY: 'auto', marginBottom: '12px' },
  importRow: { display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 0', borderBottom: '1px solid #0f1e2e' },
  importQty: { color: '#475569', fontSize: '12px', minWidth: '28px', flexShrink: 0 },
  importName: { color: '#cbd5e1', fontSize: '12px', flex: 1 },
  importSection: { color: '#334155', fontSize: '11px', flexShrink: 0 },
  importActions: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  importMergeBtn: { flex: 1, padding: '7px 12px', backgroundColor: '#a855f7', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 },
  importReplaceBtn: { flex: 1, padding: '7px 12px', backgroundColor: 'transparent', color: '#f87171', border: '1px solid #ef4444', borderRadius: '5px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 },
  deckPanel: { backgroundColor: '#16213e', border: '1px solid #1e293b', borderRadius: '10px', padding: '18px' },
  deckHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' },
  deckTitle: { color: '#94a3b8', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' },
  deckStats: { marginLeft: '10px', color: '#475569', fontWeight: 400, fontSize: '11px', textTransform: 'none', letterSpacing: 0 },
  deckActions: { display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' },
  viewToggle: { display: 'flex', borderRadius: '6px', overflow: 'hidden', border: '1px solid #334155' },
  toggleBtn: { background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: '11px', padding: '3px 9px', fontWeight: 600 },
  toggleBtnActive: { backgroundColor: '#1e3a5f', color: '#a855f7' },
  showBtn: { backgroundColor: '#0ea5e9', color: 'white', border: 'none', borderRadius: '5px', padding: '3px 10px', fontSize: '12px', fontWeight: 600, textDecoration: 'none', display: 'inline-block' },
  clearBtn: { background: 'none', border: '1px solid #334155', color: '#475569', cursor: 'pointer', fontSize: '12px', padding: '3px 10px', borderRadius: '4px' },
  emptyDeck: { textAlign: 'center', padding: '36px 16px', color: '#475569', fontSize: '14px' },
  emptyIcon: { fontSize: '32px', marginBottom: '10px' },
  saveRow: { marginTop: '20px', borderTop: '1px solid #1e293b', paddingTop: '16px' },
  successMsg: { backgroundColor: '#14291e', color: '#4ade80', border: '1px solid #22c55e', padding: '10px 14px', borderRadius: '6px', fontSize: '13px', marginBottom: '10px' },
  errorMsg: { backgroundColor: '#3b1c1c', color: '#f87171', border: '1px solid #ef4444', padding: '10px 14px', borderRadius: '6px', fontSize: '13px', marginBottom: '10px' },
  saveBtn: { width: '100%', padding: '13px', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '15px', fontWeight: 700 },
  saveBtnDisabled: { opacity: 0.6, cursor: 'not-allowed' },
};

const cs: Record<string, React.CSSProperties> = {
  section: { marginBottom: '18px' },
  sectionLabel: { color: '#475569', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px', paddingBottom: '4px', borderBottom: '1px solid #1e293b' },
  row: { display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 6px', borderRadius: '5px', marginBottom: '2px', position: 'relative', backgroundColor: '#0f1e2e' },
  proxyRow: { backgroundColor: '#1c1500' },
  qtyInput: { width: '44px', padding: '3px 6px', backgroundColor: '#0f3460', border: '1px solid #334155', borderRadius: '4px', color: '#e2e8f0', fontSize: '13px', textAlign: 'center', flexShrink: 0 },
  name: { flex: 1, fontSize: '14px', fontWeight: 500, cursor: 'default', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  proxyBadge: { marginLeft: '8px', backgroundColor: '#3b2c00', color: '#f59e0b', fontSize: '10px', padding: '1px 5px', borderRadius: '999px' },
  proxyToggle: { cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center' },
  removeBtn: { background: 'none', border: 'none', color: '#334155', cursor: 'pointer', fontSize: '14px', padding: '0 2px', flexShrink: 0, lineHeight: 1, transition: 'color 0.1s' },
  tooltip: { position: 'absolute', left: 'calc(100% + 10px)', top: 0, zIndex: 200, pointerEvents: 'none' },
  tooltipImg: { width: '200px', borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.8)' },
};
