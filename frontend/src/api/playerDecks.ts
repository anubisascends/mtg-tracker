import client from './client';

export type DeckSection = 'MainDeck' | 'Sideboard' | 'Commander';

export interface PlayerDeckCardResponse {
  id: number;
  cardName: string;
  quantity: number;
  section: DeckSection;
  isProxy: boolean;
}

export interface PlayerDeckResponse {
  id: number;
  name: string;
  format: string | null;
  totalCards: number;
  createdAt: string;
  updatedAt: string;
  cards: PlayerDeckCardResponse[];
}

export interface PlayerDeckCardRequest {
  cardName: string;
  quantity: number;
  section: number; // 0=MainDeck, 1=Sideboard, 2=Commander
  isProxy: boolean;
}

export interface SavePlayerDeckRequest {
  name: string;
  format?: string;
  cards: PlayerDeckCardRequest[];
}

export const getMyDecks = () =>
  client.get<PlayerDeckResponse[]>('/my-decks').then((r) => r.data);

export const getMyDeck = (id: number) =>
  client.get<PlayerDeckResponse>(`/my-decks/${id}`).then((r) => r.data);

export const createDeck = (data: SavePlayerDeckRequest) =>
  client.post<PlayerDeckResponse>('/my-decks', data).then((r) => r.data);

export const updateDeck = (id: number, data: SavePlayerDeckRequest) =>
  client.put<PlayerDeckResponse>(`/my-decks/${id}`, data).then((r) => r.data);

export const deleteDeck = (id: number) =>
  client.delete(`/my-decks/${id}`);
