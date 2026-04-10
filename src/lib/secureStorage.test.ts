import { describe, it, expect, beforeEach, vi } from 'vitest';
import { secureSet, secureGet, secureRemove } from './secureStorage';

describe('secureStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stores and retrieves a value', async () => {
    await secureSet('test-key', 'hello-world');
    const result = await secureGet('test-key');
    expect(result).toBe('hello-world');
  });

  it('returns null for missing keys', async () => {
    const result = await secureGet('nonexistent');
    expect(result).toBeNull();
  });

  it('removes a key', async () => {
    await secureSet('test-key', 'value');
    secureRemove('test-key');
    const result = await secureGet('test-key');
    expect(result).toBeNull();
  });

  it('stores encrypted data (not plain text)', async () => {
    const secret = 'my-secret-token-12345';
    await secureSet('token-key', secret);
    const raw = localStorage.getItem('token-key');
    expect(raw).not.toBe(secret);
    // Should be JSON with iv and ct fields
    const parsed = JSON.parse(raw!);
    expect(parsed).toHaveProperty('iv');
    expect(parsed).toHaveProperty('ct');
  });

  it('handles different values for same key', async () => {
    await secureSet('key', 'first');
    expect(await secureGet('key')).toBe('first');
    await secureSet('key', 'second');
    expect(await secureGet('key')).toBe('second');
  });
});
