import client from './client';

export interface PlayerResponse {
  id: number;
  username: string;
  nickname: string | null;
  displayName: string;
  email: string;
  lifetimeWins: number;
  lifetimeLosses: number;
  lifetimeDraws: number;
  totalMatches: number;
  createdAt: string;
}

export const getPlayers = () => client.get<PlayerResponse[]>('/players').then((r) => r.data);

export const getPlayer = (id: number) => client.get<PlayerResponse>(`/players/${id}`).then((r) => r.data);

export const getPlayerRegistrations = (id: number) =>
  client.get(`/players/${id}/registrations`).then((r) => r.data);
