export const AUTH_EMAIL_QUEUE = 'auth-email';
export const AUTH_ACTION_TOKEN_PURPOSE = {
  PASSWORD_SETUP: 'PASSWORD_SETUP',
  PASSWORD_RESET: 'PASSWORD_RESET',
} as const;

export type AuthEmailPurpose = (typeof AUTH_ACTION_TOKEN_PURPOSE)[keyof typeof AUTH_ACTION_TOKEN_PURPOSE];

export interface AuthEmailJob {
  userId: string;
  purpose: AuthEmailPurpose;
}