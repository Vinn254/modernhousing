import crypto from 'crypto';

/**
 * SBM Bank Kenya IPN messages are exchanged as BASE64(AES(json)) using a secret key
 * issued per registered 3rd-party account. The reference document does not state the
 * exact key size/cipher mode, so we derive a usable AES key from whatever secret key
 * string was configured and support both ECB and CBC(zero-IV) framing, which are the
 * two variants commonly used by Kenyan bank IPN integrations of this kind.
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

  // Fallback: hash to a 32-byte key for AES-256.
  return crypto.createHash('sha256').update(trimmed, 'utf8').digest();
}

function algorithmForKey(key: Buffer, mode: 'ecb' | 'cbc'): string {
  const bits = key.length * 8;
  return `aes-${bits}-${mode}`;
}

export function decryptIpnPayload(base64Cipher: string, secretKey: string): any {
  const key = deriveKey(secretKey);
  const cipherBuffer = Buffer.from(base64Cipher, 'base64');

  const attempts: Array<() => string> = [
    () => {
      const decipher = crypto.createDecipheriv(algorithmForKey(key, 'ecb'), key, null);
      return Buffer.concat([decipher.update(cipherBuffer), decipher.final()]).toString('utf8');
    },
    () => {
      const iv = Buffer.alloc(16, 0);
      const decipher = crypto.createDecipheriv(algorithmForKey(key, 'cbc'), key, iv);
      return Buffer.concat([decipher.update(cipherBuffer), decipher.final()]).toString('utf8');
    },
  ];

  for (const attempt of attempts) {
    try {
      const json = attempt();
      return JSON.parse(json);
    } catch {
      // try next mode
    }
  }

  throw new Error('Unable to decrypt SBM IPN payload with configured secret key');
}

export function encryptIpnResponse(payload: any, secretKey: string): string {
  const key = deriveKey(secretKey);
  const json = JSON.stringify(payload);
  const cipher = crypto.createCipheriv(algorithmForKey(key, 'ecb'), key, null);
  const encrypted = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()]);
  return encrypted.toString('base64');
}
