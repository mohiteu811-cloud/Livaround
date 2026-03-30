/**
 * Referral tracking utility.
 * Stores referral code from ?ref=CODE in a cookie (30-day expiry) and localStorage.
 * First-touch attribution — if a code is already stored, don't overwrite it.
 */

const COOKIE_NAME = 'livaround_ref';
const LS_KEY = 'livaround_ref';
const LS_TIMESTAMP_KEY = 'livaround_ref_ts';
const EXPIRY_DAYS = 30;
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://livaroundbackend-production.up.railway.app';

export function captureReferral(): void {
  if (typeof window === 'undefined') return;

  const params = new URLSearchParams(window.location.search);
  const code = params.get('ref');
  if (!code) return;

  // First-touch: don't overwrite if already set and not expired
  const existing = getReferralCode();
  if (existing) return;

  // Set cookie (30 days)
  const expires = new Date();
  expires.setDate(expires.getDate() + EXPIRY_DAYS);
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(code)};expires=${expires.toUTCString()};path=/;SameSite=Lax`;

  // Set localStorage with timestamp
  localStorage.setItem(LS_KEY, code);
  localStorage.setItem(LS_TIMESTAMP_KEY, Date.now().toString());

  // Track click
  fetch(`${API_URL}/api/partner/track-click`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  }).catch(() => {}); // Fire and forget

  // Clean URL (remove ref param)
  const url = new URL(window.location.href);
  url.searchParams.delete('ref');
  window.history.replaceState({}, '', url.toString());
}

export function getReferralCode(): string | null {
  if (typeof window === 'undefined') return null;

  // Check localStorage first (with expiry check)
  const lsCode = localStorage.getItem(LS_KEY);
  const lsTimestamp = localStorage.getItem(LS_TIMESTAMP_KEY);
  if (lsCode && lsTimestamp) {
    const elapsed = Date.now() - parseInt(lsTimestamp);
    const expiryMs = EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    if (elapsed < expiryMs) return lsCode;
    // Expired — clean up
    localStorage.removeItem(LS_KEY);
    localStorage.removeItem(LS_TIMESTAMP_KEY);
  }

  // Fallback to cookie
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]*)`));
  if (match) return decodeURIComponent(match[1]);

  return null;
}

export function clearReferral(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(LS_KEY);
  localStorage.removeItem(LS_TIMESTAMP_KEY);
  document.cookie = `${COOKIE_NAME}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
}
