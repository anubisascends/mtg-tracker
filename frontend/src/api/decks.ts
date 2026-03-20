import client from './client';

export type DeckSection = 'MainDeck' | 'Sideboard' | 'Commander';

export interface DeckCardResponse {
  id: number;
  cardName: string;
  quantity: number;
  section: DeckSection;
  isProxy: boolean;
}

export interface DeckSubmissionResponse {
  id: number;
  eventId: number;
  playerId: number;
  playerDisplayName: string;
  submittedAt: string;
  updatedAt: string;
  cards: DeckCardResponse[];
}

export interface DeckCardRequest {
  cardName: string;
  quantity: number;
  section: number; // 0=MainDeck, 1=Sideboard, 2=Commander
  isProxy: boolean;
}

export const getMyDeck = (eventId: number) =>
  client.get<DeckSubmissionResponse>(`/events/${eventId}/deck`).then((r) => r.data);

export const submitDeck = (eventId: number, cards: DeckCardRequest[]) =>
  client.post<DeckSubmissionResponse>(`/events/${eventId}/deck`, { cards }).then((r) => r.data);

export const getAllDecks = (eventId: number) =>
  client.get<DeckSubmissionResponse[]>(`/events/${eventId}/deck/all`).then((r) => r.data);
