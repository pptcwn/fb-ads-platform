import { Response } from 'express';

export const AUTH_COOKIE_NAME = 'fb_ads_token';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function setAuthCookie(res: Response, token: string): void {
  const secure = process.env.NODE_ENV === 'production';
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    maxAge: SEVEN_DAYS_MS,
    path: '/',
  });
}

export function clearAuthCookie(res: Response): void {
  const secure = process.env.NODE_ENV === 'production';
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
  });
}