import client from './client';

export interface AuthResponse {
  token: string;
  userId: number;
  username: string;
  email: string;
  role: string;
}

export const register = (data: { username: string; email: string; password: string; nickname?: string }) =>
  client.post<AuthResponse>('/auth/register', data).then((r) => r.data);

export const login = (data: { email: string; password: string }) =>
  client.post<AuthResponse>('/auth/login', data).then((r) => r.data);

export const changePassword = (data: { currentPassword: string; newPassword: string }) =>
  client.put('/auth/change-password', data);

export const adminResetPassword = (playerId: number, newPassword: string) =>
  client.put(`/players/${playerId}/reset-password`, { newPassword });
