import client from './client';

export interface RegistrationResponse {
  id: number;
  eventId: number;
  playerId: number;
  playerUsername: string;
  playerDisplayName: string;
  isEliminated: boolean;
  eventLosses: number;
  isDropped: boolean;
  droppedAtRound: number;
  registeredAt: string;
}

export const registerForEvent = (eventId: number) =>
  client.post<RegistrationResponse>('/registrations', { eventId }).then((r) => r.data);

export const adminRegisterPlayer = (eventId: number, playerId: number) =>
  client.post<RegistrationResponse>(`/events/${eventId}/register-player`, { playerId }).then((r) => r.data);

export const dropPlayer = (eventId: number, registrationId: number) =>
  client.post<RegistrationResponse>(`/events/${eventId}/registrations/${registrationId}/drop`).then((r) => r.data);

export const undropPlayer = (eventId: number, registrationId: number) =>
  client.post<RegistrationResponse>(`/events/${eventId}/registrations/${registrationId}/undrop`).then((r) => r.data);

export const selfDrop = (eventId: number) =>
  client.post<RegistrationResponse>(`/events/${eventId}/self-drop`).then((r) => r.data);

export const selfUndrop = (eventId: number) =>
  client.post<RegistrationResponse>(`/events/${eventId}/self-undrop`).then((r) => r.data);

export const cancelRegistration = (id: number) => client.delete(`/registrations/${id}`);

export const getEventRegistrations = (eventId: number) =>
  client.get<RegistrationResponse[]>(`/events/${eventId}/registrations`).then((r) => r.data);
