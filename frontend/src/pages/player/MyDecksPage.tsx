import { useEffect, useRef, useState } from 'react';
import {
  getMyDecks, createDeck, updateDeck, deleteDeck,
  PlayerDeckResponse, PlayerDeckCardRequest, SavePlayerDeckRequest,
} from '../../api/playerDecks';
import { autocomplete, getCardByName, getCardImageUri, ScryfallCard } from '../../api/scryfall';

type Section = 'MainDeck' | 'Sideboard' | 'Commander';
const SECTION_NUM: Record<Section, number> = { MainDeck: 0, Sideboard: 1, Commander: 2 };
const FORMATS = ['Standard', 'Modern', 'Legacy', 'Vintage', 'Commander', 'Draft', 'Sealed', 'Pioneer', 'Pauper'];

interface LocalCard {
  cardName: string;
  quantity: number;
  section: Section;
  isProxy: boolean;
  scryfallData?: ScryfallCard | null;
}

function parseDeckText(text: string): LocalCard[] {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  let section: Section = 'MainDeck';
  const cards: LocalCard[] = [];
  for (const line of lines) {
    if (/^(commander|companion)$/i.test(line)) { section = 'Commander'; continue; }
    if (/^(deck|main( deck)?|mainboard)$/i.test(line)) { section = 'MainDeck'; continue; }
    if (/^(sideboard|sb|sb:|\/\/sideboard)/i.test(line)) { section = 'Sideboard'; continue; }
    if (line.startsWith('//')) continue;
    const m = line.match(/^(\d+)x?\s+(.+?)(?:\s+\([A-Z0-9]+\)\s*\d*)?$/i);
    if (m) {
      const qty = parseInt(m[1]);
      const name = m[2].replace(/\s*\/\/.*$/, '').trim();
      if (name && qty > 0) cards.push({ cardName: name, quantity: qty, section, isProxy: false });
    } else {
      const name = line.replace(/\s*\([A-Z0-9]+\)\s*\d*$/i, '').replace(/\s*\/\/.*$/, '').trim();
      if (name) cards.push({ cardName: name, quantity: 1, section, isProxy: false });
    }
  }
  return cards;
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function MyDecksPage() {
  const [decks, setDecks] = useState<PlayerDeckResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<PlayerDeckResponse | null | 'new'>(null);

  const load = () =>
    getMyDecks().then(setDecks).finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const handleDelete = async (deck: PlayerDeckResponse) => {
    if (!confirm(`Delete "${deck.name}"? This cannot be undone.`)) return;
    await deleteDeck(deck.id);
    setDecks((d) => d.filter((x) => x.id !== deck.id));
    if (editing !== 'new' && editing?.id === deck.id) setEditing(null);
  };

  const handleSaved = (deck: PlayerDeckResponse) => {
    setDecks((prev) => {
      const idx = prev.findIndex((d) => d.id === deck.id);
      return idx >= 0 ? prev.map((d) => (d.id === deck.id ? deck : d)) : [deck, ...prev];
    });
    setEditing(deck);
  };

  if (loading) return <div style={s.loading}>Loading…</div>;

  return (
    <div style={s.root}>
      <div style={s.pageHeader}>
        <h1 style={s.title}>My Decks</h1>
        <button style={s.newBtn} onClick={() => setEditing('new')}>+ New Deck</button>
      </div>

      <div style={s.layout}>
        {/* ── Deck list ── */}
        <div style={s.listPanel}>
          {decks.length === 0 && editing !== 'new' && (
            <div style={s.emptyList}>
              <div style={s.emptyIcon}>🃏</div>
              <p>No saved decks yet.</p>
              <button style={s.newBtnSm} onClick={() => setEditing('new')}>Create your first deck</button>
            </div>
          )}
          {decks.map((deck) => {
            const isActive = editing !== 'new' && editing?.id === deck.id;
            return (
              <div key={deck.id} style={{ ...s.deckCard, ...(isActive ? s.deckCardActive : {}) }}>
                <div style={s.deckCardInfo} onClick={() => setEditing(isActive ? null : deck)}>
                  <div style={s.deckName}>{deck.name}</div>
                  <div style={s.deckMeta}>
                    {deck.format && <span style={s.formatBadge}>{deck.format}</span>}
                    <span style={s.cardCount}>{deck.totalCards} cards</span>
                    <span style={s.deckDate}>· {new Date(deck.updatedAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <div style={s.deckCardActions}>
                  <button style={s.editBtn} onClick={() => setEditing(isActive ? null : deck)}>
                    {isActive ? 'Close' : 'Edit'}
                  </button>
                  <button style={s.deleteBtn} onClick={() => handleDelete(deck)}>Delete</button>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Editor panel ── */}
        {editing !== null && (
          <div style={s.editorPanel}>
            <DeckEditor
              key={editing === 'new' ? 'new' : editing.id}
              initial={editing === 'new' ? null : editing}
              onSaved={handleSaved}
              onCancel={() => setEditing(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ── DeckEditor ────────────────────────────────────────────────────────────────
function DeckEditor({
  initial,
  onSaved,
  onCancel,
}: {
  initial: PlayerDeckResponse | null;
  onSaved: (deck: PlayerDeckResponse) => void;
  onCancel: () => void;
}) {
  const [deckName, setDeckName] = useState(initial?.name ?? '');
  const [deckFormat, setDeckFormat] = useState(initial?.format ?? '');
  const [cards, setCards] = useState<LocalCard[]>(
    initial?.cards.map((c) => ({
      cardName: c.cardName,
      quantity: c.quantity,
      section: c.section,
      isProxy: c.isProxy,
    })) ?? [],
  );
  const [tab, setTab] = useState<'search' | 'import'>('search');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Search state
  const [search, setSearch] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const [selectedCard, setSelectedCard] = useState<ScryfallCard | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [addQty, setAddQty] = useState(1);
  const [addSection, setAddSection] = useState<Section>('MainDeck');
  const [searchLoading, setSearchLoading] = useState(false);
  const [dropOpen, setDropOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Import state
  const [importText, setImportText] = useState('');
  const [importPreview, setImportPreview] = useState<LocalCard[] | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setDropOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

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
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightIdx((i) => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); selectSuggestion(highlightIdx >= 0 ? suggestions[highlightIdx] : suggestions[0]); }
    else if (e.key === 'Escape') { setDropOpen(false); }
  };

  const handleAddCard = () => {
    if (!selectedCard) return;
    setCards((prev) => {
      const hit = prev.find(
        (c) => c.cardName.toLowerCase() === selectedCard.name.toLowerCase() && c.section === addSection,
      );
      if (hit) return prev.map((c) => c === hit ? { ...c, quantity: c.quantity + addQty } : c);
      return [...prev, { cardName: selectedCard.name, quantity: addQty, section: addSection, isProxy: false, scryfallData: selectedCard }];
    });
    setSearch('');
    setSelectedCard(null);
    setPreview(null);
    setAddQty(1);
  };

  const handleConfirmImport = (replace: boolean) => {
    if (!importPreview) return;
    setCards(replace ? importPreview : mergeCards(cards, importPreview));
    setImportText('');
    setImportPreview(null);
    setTab('search');
  };

  const handleSave = async () => {
    if (!deckName.trim()) { setSaveError('Deck name is required.'); return; }
    if (cards.length === 0) { setSaveError('Add at least one card.'); return; }
    setSaving(true);
    setSaveError('');
    try {
      const payload: SavePlayerDeckRequest = {
        name: deckName.trim(),
        format: deckFormat || undefined,
        cards: cards.map((c) => ({
          cardName: c.cardName,
          quantity: c.quantity,
          section: SECTION_NUM[c.section],
          isProxy: c.isProxy,
        } as PlayerDeckCardRequest)),
      };
      const result = initial ? await updateDeck(initial.id, payload) : await createDeck(payload);
      onSaved(result);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setSaveError(err?.response?.data?.message ?? 'Failed to save deck.');
    } finally {
      setSaving(false);
    }
  };

  const mainDeck  = cards.filter((c) => c.section === 'MainDeck');
  const sideboard = cards.filter((c) => c.section === 'Sideboard');
  const commander = cards.filter((c) => c.section === 'Commander');
  const totalMain = mainDeck.reduce((n, c) => n + c.quantity, 0);
  const totalSide = sideboard.reduce((n, c) => n + c.quantity, 0);
  const totalCmd  = commander.reduce((n, c) => n + c.quantity, 0);

  const ipMain = importPreview?.filter((c) => c.section === 'MainDeck').reduce((n, c) => n + c.quantity, 0) ?? 0;
  const ipSide = importPreview?.filter((c) => c.section === 'Sideboard').reduce((n, c) => n + c.quantity, 0) ?? 0;
  const ipCmd  = importPreview?.filter((c) => c.section === 'Commander').reduce((n, c) => n + c.quantity, 0) ?? 0;

  return (
    <div>
      {/* Deck name + format */}
      <div style={ed.metaRow}>
        <div style={{ flex: 2 }}>
          <label style={ed.label}>Deck Name</label>
          <input
            style={ed.input}
            placeholder="My Deck"
            value={deckName}
            onChange={(e) => setDeckName(e.target.value)}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={ed.label}>Format</label>
          <select style={ed.input} value={deckFormat} onChange={(e) => setDeckFormat(e.target.value)}>
            <option value="">— any —</option>
            {FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
      </div>

      <div style={ed.twoCol}>
        {/* Left: add card / import */}
        <div style={ed.leftPanel}>
          <div style={ed.tabs}>
            <button style={{ ...ed.tab, ...(tab === 'search' ? ed.tabActive : {}) }} onClick={() => setTab('search')}>Search & Add</button>
            <button style={{ ...ed.tab, ...(tab === 'import' ? ed.tabActive : {}) }} onClick={() => setTab('import')}>Paste Import</button>
          </div>

          {tab === 'search' && (
            <div style={ed.tabBody}>
              <div style={{ position: 'relative', marginBottom: '12px' }} ref={searchRef}>
                <input
                  style={ed.input}
                  placeholder="Type a card name…"
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onFocus={() => suggestions.length > 0 && setDropOpen(true)}
                  onKeyDown={handleSearchKeyDown}
                  autoComplete="off"
                />
                {dropOpen && suggestions.length > 0 && (
                  <div style={ed.dropdown}>
                    {suggestions.map((name, i) => (
                      <div
                        key={name}
                        style={{ ...ed.dropItem, ...(i === highlightIdx ? ed.dropItemActive : {}) }}
                        onMouseDown={() => selectSuggestion(name)}
                        onMouseEnter={() => setHighlightIdx(i)}
                      >
                        {name}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {searchLoading && <div style={ed.hint}>Loading…</div>}

              {preview && selectedCard && (
                <div style={ed.previewWrap}>
                  <img src={preview} alt={selectedCard.name} style={ed.cardImg} />
                  <div>
                    <div style={ed.cardName}>{selectedCard.name}</div>
                    {selectedCard.mana_cost && <div style={ed.cardDetail}>{selectedCard.mana_cost}</div>}
                    {selectedCard.type_line && <div style={ed.cardDetail}>{selectedCard.type_line}</div>}
                  </div>
                </div>
              )}

              {selectedCard && (
                <div style={ed.addControls}>
                  <div style={ed.addRow}>
                    <span style={ed.addLabel}>Qty</span>
                    <input
                      style={{ ...ed.input, width: '60px' }}
                      type="number" min={1} max={99} value={addQty}
                      onChange={(e) => setAddQty(Math.max(1, parseInt(e.target.value) || 1))}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddCard(); }}
                    />
                    <span style={ed.addLabel}>Section</span>
                    <select style={{ ...ed.input, flex: 1 }} value={addSection} onChange={(e) => setAddSection(e.target.value as Section)}>
                      <option value="MainDeck">Main Deck</option>
                      <option value="Sideboard">Sideboard</option>
                      <option value="Commander">Commander</option>
                    </select>
                  </div>
                  <button style={ed.addBtn} onClick={handleAddCard}>Add to Deck</button>
                </div>
              )}

              {!selectedCard && !searchLoading && (
                <p style={ed.searchHint}>Search for a card, or use Paste Import to add many at once.</p>
              )}
            </div>
          )}

          {tab === 'import' && (
            <div style={ed.tabBody}>
              <p style={ed.importHint}>Paste a decklist — Arena, MTGO, Moxfield, or plain text.</p>
              <textarea
                style={ed.textarea}
                placeholder="4 Lightning Bolt&#10;20 Island&#10;&#10;Sideboard&#10;2 Mystical Dispute"
                value={importText}
                onChange={(e) => { setImportText(e.target.value); setImportPreview(null); }}
                rows={10}
                spellCheck={false}
              />
              <button
                style={ed.parseBtn}
                onClick={() => setImportPreview(parseDeckText(importText))}
                disabled={importText.trim().length === 0}
              >
                Preview Import
              </button>
              {importPreview && (
                <div style={ed.importPreview}>
                  <div style={ed.importStats}>
                    {importPreview.length} unique cards —{' '}
                    {ipMain > 0 && <span>{ipMain} main </span>}
                    {ipSide > 0 && <span>{ipSide} side </span>}
                    {ipCmd  > 0 && <span>{ipCmd} cmd</span>}
                  </div>
                  <div style={ed.importList}>
                    {importPreview.map((c, i) => (
                      <div key={i} style={ed.importRow}>
                        <span style={ed.importQty}>{c.quantity}x</span>
                        <span style={ed.importName}>{c.cardName}</span>
                        <span style={ed.importSection}>{c.section === 'MainDeck' ? 'Main' : c.section === 'Sideboard' ? 'Side' : 'Cmd'}</span>
                      </div>
                    ))}
                  </div>
                  <div style={ed.importActions}>
                    {cards.length > 0 ? (
                      <>
                        <button style={ed.importMerge} onClick={() => handleConfirmImport(false)}>Merge</button>
                        <button style={ed.importReplace} onClick={() => handleConfirmImport(true)}>Replace</button>
                      </>
                    ) : (
                      <button style={ed.importMerge} onClick={() => handleConfirmImport(false)}>Import</button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: deck list */}
        <div style={ed.deckPanel}>
          <div style={ed.deckHeader}>
            <span style={ed.deckTitle}>
              {totalMain + totalSide + totalCmd > 0
                ? `${totalMain > 0 ? `${totalMain} main` : ''}${totalSide > 0 ? ` · ${totalSide} side` : ''}${totalCmd > 0 ? ` · ${totalCmd} cmd` : ''}`
                : 'Empty deck'}
            </span>
            {cards.length > 0 && (
              <button style={ed.clearBtn} onClick={() => { if (confirm('Clear deck?')) setCards([]); }}>Clear</button>
            )}
          </div>

          {cards.length === 0 ? (
            <div style={ed.emptyDeck}>No cards yet.</div>
          ) : (
            <>
              {commander.length > 0 && <EditorSection label="Commander" cards={commander} allCards={cards}
                onRemove={(i) => setCards((p) => p.filter((_, x) => x !== i))}
                onQtyChange={(i, q) => setCards((p) => p.map((c, x) => x === i ? { ...c, quantity: Math.max(1, q) } : c))}
                onProxyToggle={(i) => setCards((p) => p.map((c, x) => x === i ? { ...c, isProxy: !c.isProxy } : c))}
              />}
              {mainDeck.length > 0 && <EditorSection label={`Main Deck · ${totalMain}`} cards={mainDeck} allCards={cards}
                onRemove={(i) => setCards((p) => p.filter((_, x) => x !== i))}
                onQtyChange={(i, q) => setCards((p) => p.map((c, x) => x === i ? { ...c, quantity: Math.max(1, q) } : c))}
                onProxyToggle={(i) => setCards((p) => p.map((c, x) => x === i ? { ...c, isProxy: !c.isProxy } : c))}
              />}
              {sideboard.length > 0 && <EditorSection label={`Sideboard · ${totalSide}`} cards={sideboard} allCards={cards}
                onRemove={(i) => setCards((p) => p.filter((_, x) => x !== i))}
                onQtyChange={(i, q) => setCards((p) => p.map((c, x) => x === i ? { ...c, quantity: Math.max(1, q) } : c))}
                onProxyToggle={(i) => setCards((p) => p.map((c, x) => x === i ? { ...c, isProxy: !c.isProxy } : c))}
              />}
            </>
          )}
        </div>
      </div>

      {/* Save/Cancel */}
      <div style={ed.footer}>
        {saveError && <div style={ed.errorMsg}>{saveError}</div>}
        <div style={ed.footerBtns}>
          <button style={ed.cancelBtn} onClick={onCancel}>Cancel</button>
          <button style={{ ...ed.saveBtn, ...(saving ? ed.saveBtnDisabled : {}) }} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : initial ? 'Update Deck' : 'Save Deck'}
          </button>
        </div>
      </div>
    </div>
  );
}

function mergeCards(existing: LocalCard[], incoming: LocalCard[]): LocalCard[] {
  const result = [...existing];
  for (const card of incoming) {
    const idx = result.findIndex(
      (c) => c.cardName.toLowerCase() === card.cardName.toLowerCase() && c.section === card.section,
    );
    if (idx >= 0) result[idx] = { ...result[idx], quantity: result[idx].quantity + card.quantity };
    else result.push(card);
  }
  return result;
}

function EditorSection({ label, cards, allCards, onRemove, onQtyChange, onProxyToggle }: {
  label: string;
  cards: LocalCard[];
  allCards: LocalCard[];
  onRemove: (i: number) => void;
  onQtyChange: (i: number, q: number) => void;
  onProxyToggle: (i: number) => void;
}) {
  return (
    <div style={cs.section}>
      <div style={cs.sectionLabel}>{label}</div>
      {cards.map((card) => {
        const realIdx = allCards.indexOf(card);
        return <EditorCardRow key={realIdx} card={card} idx={realIdx} onRemove={onRemove} onQtyChange={onQtyChange} onProxyToggle={onProxyToggle} />;
      })}
    </div>
  );
}

function EditorCardRow({ card, idx, onRemove, onQtyChange, onProxyToggle }: {
  card: LocalCard;
  idx: number;
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
        <div style={cs.tooltip}><img src={imgSrc} alt={card.cardName} style={cs.tooltipImg} /></div>
      )}
      <input style={cs.qtyInput} type="number" min={1} max={99} value={card.quantity}
        onChange={(e) => onQtyChange(idx, parseInt(e.target.value) || 1)} />
      <span style={{ ...cs.name, color: card.isProxy ? '#f59e0b' : '#e2e8f0' }}>
        {card.cardName}
        {card.isProxy && <span style={cs.proxyBadge}>PROXY</span>}
      </span>
      <label style={cs.proxyToggle} title={card.isProxy ? 'Remove proxy' : 'Mark as proxy'}>
        <input type="checkbox" checked={card.isProxy} onChange={() => onProxyToggle(idx)} style={{ accentColor: '#f59e0b', cursor: 'pointer' }} />
      </label>
      <button style={cs.removeBtn} onClick={() => onRemove(idx)} title="Remove">✕</button>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s: Record<string, React.CSSProperties> = {
  root: { maxWidth: '1100px' },
  loading: { color: '#94a3b8', textAlign: 'center', padding: '40px' },
  pageHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' },
  title: { color: '#a855f7', margin: 0, fontSize: '22px' },
  newBtn: { backgroundColor: '#a855f7', color: 'white', border: 'none', padding: '9px 18px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 },
  newBtnSm: { backgroundColor: '#a855f7', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', marginTop: '12px' },
  layout: { display: 'grid', gridTemplateColumns: '280px 1fr', gap: '20px', alignItems: 'start' },
  listPanel: { display: 'flex', flexDirection: 'column', gap: '8px' },
  emptyList: { backgroundColor: '#16213e', border: '1px solid #1e293b', borderRadius: '10px', padding: '32px 20px', textAlign: 'center', color: '#475569', fontSize: '14px' },
  emptyIcon: { fontSize: '32px', marginBottom: '10px' },
  deckCard: { backgroundColor: '#16213e', border: '1px solid #1e293b', borderRadius: '8px', padding: '12px 14px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' },
  deckCardActive: { borderColor: '#a855f7', backgroundColor: '#1a1535' },
  deckCardInfo: { flex: 1, minWidth: 0 },
  deckName: { color: '#e2e8f0', fontWeight: 600, fontSize: '14px', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  deckMeta: { display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' },
  formatBadge: { backgroundColor: '#1e3a5f', color: '#38bdf8', fontSize: '10px', padding: '1px 6px', borderRadius: '999px' },
  cardCount: { color: '#64748b', fontSize: '12px' },
  deckDate: { color: '#334155', fontSize: '11px' },
  deckCardActions: { display: 'flex', gap: '6px', flexShrink: 0 },
  editBtn: { background: 'none', border: '1px solid #334155', color: '#94a3b8', cursor: 'pointer', fontSize: '12px', padding: '3px 10px', borderRadius: '4px' },
  deleteBtn: { background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '12px', padding: '3px 6px' },
  editorPanel: { backgroundColor: '#16213e', border: '1px solid #1e293b', borderRadius: '10px', padding: '20px' },
};

const ed: Record<string, React.CSSProperties> = {
  metaRow: { display: 'flex', gap: '12px', marginBottom: '16px' },
  label: { display: 'block', color: '#94a3b8', fontSize: '12px', marginBottom: '5px' },
  input: { width: '100%', padding: '8px 10px', backgroundColor: '#0f3460', border: '1px solid #334155', borderRadius: '6px', color: '#e2e8f0', fontSize: '13px', boxSizing: 'border-box', outline: 'none' },
  twoCol: { display: 'grid', gridTemplateColumns: '300px 1fr', gap: '16px', marginBottom: '16px' },
  leftPanel: { backgroundColor: '#0d1f35', border: '1px solid #1e293b', borderRadius: '8px', overflow: 'hidden' },
  tabs: { display: 'flex', borderBottom: '1px solid #1e293b' },
  tab: { flex: 1, padding: '9px', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '12px', fontWeight: 600 },
  tabActive: { color: '#a855f7', borderBottom: '2px solid #a855f7', marginBottom: '-1px', backgroundColor: '#091525' },
  tabBody: { padding: '14px' },
  dropdown: { position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: '#0d1f35', border: '1px solid #334155', borderRadius: '6px', marginTop: '4px', maxHeight: '200px', overflowY: 'auto', zIndex: 100, boxShadow: '0 8px 24px rgba(0,0,0,0.6)' },
  dropItem: { padding: '8px 12px', color: '#cbd5e1', fontSize: '13px', cursor: 'pointer', borderBottom: '1px solid #1e293b' },
  dropItemActive: { backgroundColor: '#1e3a5f', color: '#f1f5f9' },
  hint: { color: '#475569', fontSize: '12px' },
  searchHint: { color: '#334155', fontSize: '12px', textAlign: 'center', padding: '16px 0 4px', margin: 0 },
  previewWrap: { display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '12px' },
  cardImg: { width: '80px', borderRadius: '6px', flexShrink: 0, boxShadow: '0 4px 12px rgba(0,0,0,0.5)' },
  cardName: { color: '#e2e8f0', fontWeight: 700, fontSize: '13px', marginBottom: '3px' },
  cardDetail: { color: '#64748b', fontSize: '11px', marginBottom: '2px' },
  addControls: { borderTop: '1px solid #1e293b', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' },
  addRow: { display: 'flex', alignItems: 'center', gap: '8px' },
  addLabel: { color: '#94a3b8', fontSize: '12px', flexShrink: 0 },
  addBtn: { backgroundColor: '#a855f7', color: 'white', border: 'none', borderRadius: '6px', padding: '8px 14px', cursor: 'pointer', fontWeight: 700, fontSize: '13px' },
  importHint: { color: '#64748b', fontSize: '12px', margin: '0 0 8px 0' },
  textarea: { width: '100%', padding: '8px', backgroundColor: '#091525', border: '1px solid #334155', borderRadius: '6px', color: '#cbd5e1', fontSize: '12px', fontFamily: 'monospace', resize: 'vertical', boxSizing: 'border-box', outline: 'none', display: 'block', marginBottom: '8px' },
  parseBtn: { width: '100%', padding: '8px', backgroundColor: '#0ea5e9', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '13px', marginBottom: '10px' },
  importPreview: { backgroundColor: '#091525', border: '1px solid #1e3a5f', borderRadius: '6px', padding: '10px' },
  importStats: { color: '#64748b', fontSize: '12px', marginBottom: '8px' },
  importList: { maxHeight: '160px', overflowY: 'auto', marginBottom: '10px' },
  importRow: { display: 'flex', alignItems: 'center', gap: '6px', padding: '2px 0', borderBottom: '1px solid #0f1e2e' },
  importQty: { color: '#475569', fontSize: '11px', minWidth: '26px' },
  importName: { color: '#cbd5e1', fontSize: '11px', flex: 1 },
  importSection: { color: '#334155', fontSize: '10px' },
  importActions: { display: 'flex', gap: '8px' },
  importMerge: { flex: 1, padding: '6px', backgroundColor: '#a855f7', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 },
  importReplace: { flex: 1, padding: '6px', background: 'none', color: '#f87171', border: '1px solid #ef4444', borderRadius: '5px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 },
  deckPanel: { backgroundColor: '#0d1f35', border: '1px solid #1e293b', borderRadius: '8px', padding: '14px' },
  deckHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' },
  deckTitle: { color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' },
  clearBtn: { background: 'none', border: '1px solid #334155', color: '#475569', cursor: 'pointer', fontSize: '11px', padding: '2px 8px', borderRadius: '4px' },
  emptyDeck: { color: '#334155', fontSize: '13px', textAlign: 'center', padding: '20px 0' },
  footer: { borderTop: '1px solid #1e293b', paddingTop: '14px' },
  footerBtns: { display: 'flex', justifyContent: 'flex-end', gap: '10px' },
  cancelBtn: { padding: '9px 18px', background: 'none', border: '1px solid #334155', color: '#94a3b8', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' },
  saveBtn: { padding: '9px 24px', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 700 },
  saveBtnDisabled: { opacity: 0.6, cursor: 'not-allowed' },
  errorMsg: { backgroundColor: '#3b1c1c', color: '#f87171', border: '1px solid #ef4444', padding: '8px 12px', borderRadius: '6px', fontSize: '13px', marginBottom: '10px' },
};

const cs: Record<string, React.CSSProperties> = {
  section: { marginBottom: '14px' },
  sectionLabel: { color: '#475569', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px', paddingBottom: '3px', borderBottom: '1px solid #1e293b' },
  row: { display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 6px', borderRadius: '4px', marginBottom: '2px', position: 'relative', backgroundColor: '#0f1e2e' },
  proxyRow: { backgroundColor: '#1c1500' },
  qtyInput: { width: '40px', padding: '2px 4px', backgroundColor: '#0f3460', border: '1px solid #334155', borderRadius: '4px', color: '#e2e8f0', fontSize: '12px', textAlign: 'center', flexShrink: 0 },
  name: { flex: 1, fontSize: '13px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  proxyBadge: { marginLeft: '6px', backgroundColor: '#3b2c00', color: '#f59e0b', fontSize: '9px', padding: '1px 5px', borderRadius: '999px' },
  proxyToggle: { cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center' },
  removeBtn: { background: 'none', border: 'none', color: '#334155', cursor: 'pointer', fontSize: '13px', padding: '0 2px', flexShrink: 0 },
  tooltip: { position: 'absolute', left: 'calc(100% + 8px)', top: 0, zIndex: 200, pointerEvents: 'none' },
  tooltipImg: { width: '180px', borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.8)' },
};
