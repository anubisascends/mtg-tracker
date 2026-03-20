const BASE = 'https://api.scryfall.com';

export interface ScryfallCard {
  id: string;
  name: string;
  mana_cost?: string;
  type_line?: string;
  oracle_text?: string;
  image_uris?: { small: string; normal: string; large: string };
  card_faces?: { image_uris?: { small: string; normal: string; large: string }; name: string }[];
}

/** Returns up to 20 card name suggestions for autocomplete. */
export async function autocomplete(query: string): Promise<string[]> {
  if (query.trim().length < 2) return [];
  const res = await fetch(`${BASE}/cards/autocomplete?q=${encodeURIComponent(query)}`);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.data as string[]) ?? [];
}

/** Fetch full card details by exact name. Returns null if not found. */
export async function getCardByName(name: string): Promise<ScryfallCard | null> {
  const res = await fetch(`${BASE}/cards/named?exact=${encodeURIComponent(name)}`);
  if (!res.ok) return null;
  return res.json();
}

/** Get the best image URI from a card (handles double-faced cards). */
export function getCardImageUri(card: ScryfallCard, size: 'small' | 'normal' | 'large' = 'normal'): string | null {
  if (card.image_uris) return card.image_uris[size];
  if (card.card_faces?.[0]?.image_uris) return card.card_faces[0].image_uris[size];
  return null;
}
