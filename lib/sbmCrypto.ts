import crypto from 'crypto';

/**
 * SBM Bank Kenya IPN messages are exchanged as BASE64(AES(json)) using a secret key
 * issued per registered 3rd-party account. The reference document does not state the
 * exact key size/cipher mode, so the current integration accepts a raw/base64 AES key
 * and tries ECB or CBC with a zero IV. Confirm the final framing with SBM before production.
 */
function deriveKey(secretKey: string): Buffer {
  const trimmed = secretKey.trim();

  // If the secret key is already valid base64 that decodes to a valid AES key length, use it as-is.
  if (/^[A-Za-z0-9+/]+={0,2}$/.test(trimmed) && trimmed.length % 4 === 0) {
    try {
      const decoded = Buffer.from(trimmed, 'base64');
      if ([16, 24, 32].includes(decoded.length)) return decoded;
    } catch {
      // fall through
    }
  }

  const utf8 = Buffer.from(trimmed, 'utf8');
  if ([16, 24, 32].includes(utf8.length)) return utf8;

  throw new Error('SBM secret key must decode to 16, 24, or 32 bytes; confirm its encoding with SBM');
}

function algorithmForKey(key: Buffer, mode: 'ecb' | 'cbc'): string {
  const bits = key.length * 8;
  return `aes-${bits}-${mode}`;
}

export type SbmAesMode = 'ecb' | 'cbc';

export function decryptIpnPayload(
  base64Cipher: string,
  secretKey: string,
): { payload: any; mode: SbmAesMode } {
  const key = deriveKey(secretKey);
  const normalizedCipher = base64Cipher
    .replace(/\s+/g, '')
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  if (!normalizedCipher || !/^[A-Za-z0-9+/]*={0,2}$/.test(normalizedCipher)) {
    throw new Error('SBM request body must contain Base64 ciphertext');
  }
  const unpaddedCipher = normalizedCipher.replace(/=+$/, '');
  if (unpaddedCipher.length % 4 === 1) {
    throw new Error('SBM request body is not valid Base64 ciphertext');
  }
  const encodedCipher = unpaddedCipher + '='.repeat((4 - unpaddedCipher.length % 4) % 4);
  const cipherBuffer = Buffer.from(encodedCipher, 'base64');
  if (cipherBuffer.length === 0 || cipherBuffer.toString('base64') !== encodedCipher) {
    throw new Error('SBM request body is not valid Base64 ciphertext');
  }
  if (cipherBuffer.length % 16 !== 0) {
    throw new Error(`SBM decoded ciphertext is ${cipherBuffer.length} bytes; AES ciphertext must be a multiple of 16 bytes`);
  }

  const attempts: Array<{ mode: SbmAesMode; decrypt: () => string }> = [
    {
      mode: 'ecb',
      decrypt: () => {
        const decipher = crypto.createDecipheriv(algorithmForKey(key, 'ecb'), key, null);
        return Buffer.concat([decipher.update(cipherBuffer), decipher.final()]).toString('utf8');
      },
    },
    {
      mode: 'cbc',
      decrypt: () => {
        const iv = Buffer.alloc(16, 0);
        const decipher = crypto.createDecipheriv(algorithmForKey(key, 'cbc'), key, iv);
        return Buffer.concat([decipher.update(cipherBuffer), decipher.final()]).toString('utf8');
      },
    },
  ];

  for (const attempt of attempts) {
    try {
      const json = attempt.decrypt();
      return { payload: JSON.parse(json), mode: attempt.mode };
    } catch {
      // try next mode
    }
  }

  throw new Error('Unable to decrypt SBM IPN payload with configured secret key');
}

export function encryptIpnResponse(payload: any, secretKey: string, mode: SbmAesMode = 'ecb'): string {
  const key = deriveKey(secretKey);
  const json = JSON.stringify(payload);
  const iv = mode === 'cbc' ? Buffer.alloc(16, 0) : null;
  const cipher = crypto.createCipheriv(algorithmForKey(key, mode), key, iv);
  const encrypted = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()]);
  return encrypted.toString('base64');
}
