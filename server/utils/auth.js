import crypto from 'crypto';

/**
 * Constant-time comparison of two secret strings (e.g. OTP codes, shared secrets).
 *
 * Plain `===` stops at the first differing character, so response time can correlate with
 * how much of the guess was correct (timing side-channel). `crypto.timingSafeEqual` compares
 * every byte in fixed time when buffer lengths match, which is the recommended pattern for
 * client-supplied secrets. Passwords here still use bcrypt (`bcrypt.compare`), which already
 * aims to be comparison-safe for hashes.
 *
 * Note: If the two strings differ in length, this returns `false` immediately (length check);
 * avoid logging or branching on that fact in ways that amplify side channels for your threat model.
 *
 * @param {string} secretA
 * @param {string} secretB
 * @returns {boolean}
 */
export function secureCompare(secretA, secretB) {
  const a = Buffer.from(String(secretA ?? ''), 'utf8');
  const b = Buffer.from(String(secretB ?? ''), 'utf8');
  if (a.length !== b.length) {
    return false;
  }
  if (a.length === 0) {
    return true;
  }
  return crypto.timingSafeEqual(a, b);
}
