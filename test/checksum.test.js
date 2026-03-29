import { calculateChecksum } from '../src/core/checksum.js';

describe('calculateChecksum', () => {
  it('returns a 64-character hex string (SHA-256)', () => {
    const result = calculateChecksum('SELECT 1;');
    expect(result).toMatch(/^[a-f0-9]{64}$/);
  });

  it('is deterministic — same input gives same output', () => {
    const a = calculateChecksum('CREATE TABLE users (id SERIAL);');
    const b = calculateChecksum('CREATE TABLE users (id SERIAL);');
    expect(a).toBe(b);
  });

  it('produces different checksums for different content', () => {
    const a = calculateChecksum('SELECT 1;');
    const b = calculateChecksum('SELECT 2;');
    expect(a).not.toBe(b);
  });

  it('handles empty string input', () => {
    const result = calculateChecksum('');
    expect(result).toMatch(/^[a-f0-9]{64}$/);
  });
});
