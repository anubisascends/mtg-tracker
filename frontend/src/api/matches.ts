import client from './client';

export interface MatchResponse {
  id: number;
  eventId: number;
  eventName: string;
  player1Id: number;
  player1Username: string;
  player1DisplayName: string;
  player2Id: number;
  player2Username: string;
  player2DisplayName: string;
  player1Wins: number;
  player2Wins: number;
  draws: number;
  player1Points: number;
  player2Points: number;
  isBye: boolean;
  isPending: boolean;
  round: number;
  recordedAt: string;
}

export interface RecordMatchRequest {
  eventId: number;
  player1Id: number;
  player2Id: number;
  player1Wins: number;
  player2Wins: number;
  draws: number;
}

export const recordMatch = (data: RecordMatchRequest) =>
  client.post<MatchResponse>('/matches', data).then((r) => r.data);

export const recordMatchResult = (id: number, player1Wins: number, player2Wins: number, draws: number) =>
  client.put<MatchResponse>(`/matches/${id}/result`, { player1Wins, player2Wins, draws }).then((r) => r.data);

export const getEventMatches = (eventId: number) =>
  client.get<MatchResponse[]>(`/events/${eventId}/matches`).then((r) => r.data);

export const deleteMatch = (id: number) => client.delete(`/matches/${id}`);

export const reopenMatch = (id: number) =>
  client.post<MatchResponse>(`/matches/${id}/reopen`).then((r) => r.data);
