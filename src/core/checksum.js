import crypto from 'crypto';

/**
 * Calculates a SHA-256 checksum for the provided content.
 */
export function calculateChecksum(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}
