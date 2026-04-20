import client from './client';

export interface EventResponse {
  id: number;
  name: string;
  description: string;
  format: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  status: string;
  runPhase: string | null;
  eliminationType: string;
  currentRound: number;
  maxPlayers: number;
  timerDurationSeconds: number;
  timerStartedAt: string | null;
  registeredCount: number;
  createdAt: string;
  requiresDeckRegistration: boolean;
  proxiesAllowed: boolean;
}

export interface CreateEventRequest {
  name: string;
  description: string;
  format: string;
  date: string;
  startTime?: string;
  endTime?: string;
  maxPlayers: number;
  eliminationType?: number;
  requiresDeckRegistration?: boolean;
  proxiesAllowed?: boolean;
}

export interface UpdateEventRequest {
  name?: string;
  description?: string;
  format?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  status?: number;
  maxPlayers?: number;
  eliminationType?: number;
  requiresDeckRegistration?: boolean;
  proxiesAllowed?: boolean;
}

export const getEvents = () => client.get<EventResponse[]>('/events').then((r) => r.data);

export const getEvent = (id: number) => client.get<EventResponse>(`/events/${id}`).then((r) => r.data);

export const createEvent = (data: CreateEventRequest) =>
  client.post<EventResponse>('/events', data).then((r) => r.data);

export const updateEvent = (id: number, data: UpdateEventRequest) =>
  client.put<EventResponse>(`/events/${id}`, data).then((r) => r.data);

export const deleteEvent = (id: number) => client.delete(`/events/${id}`);

export const advanceEvent = (id: number) =>
  client.post<EventResponse>(`/events/${id}/advance`).then((r) => r.data);

export const advanceRunPhase = (id: number) =>
  client.post<EventResponse>(`/events/${id}/advance-run-phase`).then((r) => r.data);

export const reverseRunPhase = (id: number) =>
  client.post<EventResponse>(`/events/${id}/reverse-run-phase`).then((r) => r.data);

export const reverseStatus = (id: number) =>
  client.post<EventResponse>(`/events/${id}/reverse-status`).then((r) => r.data);

export const generateNextRound = (id: number) =>
  client.post<EventResponse>(`/events/${id}/next-round`).then((r) => r.data);

export const createPairing = (id: number, player1Id: number, player2Id: number | null) =>
  client.post(`/events/${id}/pairings`, { player1Id, player2Id }).then((r) => r.data);

export const startTimer = (id: number, durationSeconds: number) =>
  client.post<EventResponse>(`/events/${id}/timer/start`, { durationSeconds }).then((r) => r.data);

export const stopTimer = (id: number) =>
  client.post<EventResponse>(`/events/${id}/timer/stop`).then((r) => r.data);
