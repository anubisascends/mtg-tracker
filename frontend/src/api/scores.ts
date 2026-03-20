import publicClient from './publicClient';
import client from './client';

export interface EventPlayerScore {
  registrationId: number;
  playerId: number;
  playerDisplayName: string;
  points: number;
  matchWins: number;
  matchLosses: number;
  matchDraws: number;
  byes: number;
  isEliminated: boolean;
  eventLosses: number;
  isDropped: boolean;
  droppedAtRound: number;
}

export const getEventScores = (eventId: number) =>
  client.get<EventPlayerScore[]>(`/events/${eventId}/scores`).then((r) => r.data);

export const getEventScoresPublic = (eventId: number) =>
  publicClient.get<EventPlayerScore[]>(`/events/${eventId}/scores`).then((r) => r.data);
