'use client';

import { api, User } from './api';

export function saveToken(token: string) {
  localStorage.setItem('livaround_token', token);
}

export function clearToken() {
  localStorage.removeItem('livaround_token');
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('livaround_token');
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    return await api.auth.me();
  } catch {
    return null;
  }
}
