import crypto from 'crypto';

/**
 * Calculates a SHA-256 checksum for the provided content.
 * Normalizes line endings to LF (\n) to ensure cross-platform consistency.
 */
export function calculateChecksum(content) {
  const normalized = content.replace(/\r\n/g, '\n');
  return crypto.createHash('sha256').update(normalized).digest('hex');
}
