import client from './client';

export interface PlayerResponse {
  id: number;
  username: string;
  nickname: string | null;
  displayName: string;
  email: string;
  role: string;
  lifetimeWins: number;
  lifetimeLosses: number;
  lifetimeDraws: number;
  totalMatches: number;
  createdAt: string;
}

export interface AdminUpdatePlayerRequest {
  username: string;
  email: string;
  nickname?: string;
  role: string;
}

export interface AdminCreatePlayerRequest {
  username: string;
  email: string;
  nickname?: string;
}

export interface AdminCreatePlayerResponse {
  userId: number;
  username: string;
  email: string;
  resetToken: string;
  emailConfigured: boolean;
}

export const getPlayers = (archived = false) =>
  client.get<PlayerResponse[]>('/players', { params: { archived } }).then((r) => r.data);

export const getPlayer = (id: number) => client.get<PlayerResponse>(`/players/${id}`).then((r) => r.data);

export const getPlayerRegistrations = (id: number) =>
  client.get(`/players/${id}/registrations`).then((r) => r.data);

export const adminCreatePlayer = (data: AdminCreatePlayerRequest) =>
  client.post<AdminCreatePlayerResponse>('/players', data).then((r) => r.data);

export const generatePlayerInvite = (playerId: number) =>
  client.post<AdminCreatePlayerResponse>(`/players/${playerId}/invite`).then((r) => r.data);

export const sendPlayerInviteEmail = (playerId: number) =>
  client.post(`/players/${playerId}/send-invite-email`);

export const adminUpdatePlayer = (id: number, data: AdminUpdatePlayerRequest) =>
  client.put<PlayerResponse>(`/players/${id}`, data).then((r) => r.data);

export const adminDeletePlayer = (id: number) =>
  client.delete(`/players/${id}`);

export const adminUnarchivePlayer = (id: number) =>
  client.post(`/players/${id}/unarchive`);
