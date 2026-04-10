/**
 * Secure storage utility for sensitive tokens.
 *
 * Encrypts values using Web Crypto API (AES-GCM) before storing in localStorage.
 * The encryption key is derived from the app origin, binding tokens to this
 * specific domain. Exfiltrated ciphertext is useless in another context.
 *
 * This is defense-in-depth — it raises the bar for token theft via XSS
 * by preventing trivial copy-paste of localStorage values.
 */

const SALT = new TextEncoder().encode('tradecafe-device-token-v1');

async function deriveKey(): Promise<CryptoKey> {
  // Derive a key from the origin — tokens are bound to this domain
  const seed = new TextEncoder().encode(window.location.origin + ':tradecafe');
  const baseKey = await crypto.subtle.importKey('raw', seed, 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: SALT, iterations: 100_000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Safe localStorage.setItem with quota-exceeded handling (iOS Safari ~5-10 MB limit) */
function safeSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    if (e instanceof DOMException && (e.code === 22 || e.name === 'QuotaExceededError')) {
      // Storage full — silently fail rather than crash; the token simply won't persist
      return;
    }
    throw e;
  }
}

export async function secureSet(storageKey: string, value: string): Promise<void> {
  try {
    const key = await deriveKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(value);
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);

    const payload = JSON.stringify({
      iv: Array.from(iv),
      ct: Array.from(new Uint8Array(ciphertext)),
    });
    safeSetItem(storageKey, payload);
  } catch {
    // Fallback: store as-is if Web Crypto unavailable (e.g. non-secure context)
    safeSetItem(storageKey, value);
  }
}

export async function secureGet(storageKey: string): Promise<string | null> {
  const raw = localStorage.getItem(storageKey);
  if (!raw) return null;

  try {
    const { iv, ct } = JSON.parse(raw) as { iv: number[]; ct: number[] };
    if (!iv || !ct) return raw; // Legacy unencrypted value

    const key = await deriveKey();
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(iv) },
      key,
      new Uint8Array(ct),
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    // If decryption fails (corrupted, tampered, or legacy plain text), clear it
    localStorage.removeItem(storageKey);
    return null;
  }
}

export function secureRemove(storageKey: string): void {
  localStorage.removeItem(storageKey);
}
