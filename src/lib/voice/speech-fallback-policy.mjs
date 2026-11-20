const DEVICE_FALLBACK_STATUSES = new Set([400, 404, 408, 429, 500, 502, 503, 504]);

/**
 * Provider-backed speech is optional. When it is unavailable or does not
 * support a locale, let an installed browser voice try before failing.
 * Authentication and request-size failures remain visible to the user.
 */
export function shouldFallbackToDeviceSpeech(status) {
  return DEVICE_FALLBACK_STATUSES.has(Number(status));
}
