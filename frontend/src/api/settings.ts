import client from './client';

export interface EmailSettingsDto {
  host: string;
  port: number;
  fromAddress: string;
  username: string;
  password: string;
  enableSsl: boolean;
  isConfigured: boolean;
}

export const getEmailSettings = () =>
  client.get<EmailSettingsDto>('/settings/email').then((r) => r.data);

export const updateEmailSettings = (data: Omit<EmailSettingsDto, 'isConfigured'>) =>
  client.put<EmailSettingsDto>('/settings/email', data).then((r) => r.data);

export const testEmailSettings = () =>
  client.post<{ message: string }>('/settings/email/test').then((r) => r.data);
