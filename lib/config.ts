/**
 * When IS_COMMERCIAL is false the app behaves as fully open-source with no
 * payment gates or usage limits.  Set PAYMENTS_ENABLED=true in your .env to
 * enable commercial / paid features.
 */
export const IS_COMMERCIAL = process.env.PAYMENTS_ENABLED === 'true';
