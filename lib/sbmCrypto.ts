import crypto from 'crypto';

/**
 * SBM specifies Base64(AES-128-ECB(JSON)) with a 16-byte secret key.
 */
function deriveKey(secretKey: string): Buffer {
  const trimmed = secretKey.trim();

  const utf8 = Buffer.from(trimmed, 'utf8');
  if (utf8.length === 16) return utf8;

  if (/^[a-fA-F0-9]{32}$/.test(trimmed)) {
    return Buffer.from(trimmed, 'hex');
  }

  if (/^[A-Za-z0-9+/]{22}==$/.test(trimmed)) {
    const decoded = Buffer.from(trimmed, 'base64');
    if (decoded.length === 16 && decoded.toString('base64') === trimmed) return decoded;
  }

  throw new Error('SBM secret key must represent exactly 16 bytes (AES-128)');
}

export function decryptIpnPayload(base64Cipher: string, secretKey: string): any {
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

  const decipher = crypto.createDecipheriv('aes-128-ecb', key, null);
  const json = Buffer.concat([decipher.update(cipherBuffer), decipher.final()]).toString('utf8');
  return JSON.parse(json);
}

export function encryptIpnResponse(payload: any, secretKey: string): string {
  const key = deriveKey(secretKey);
  const json = JSON.stringify(payload);
  const cipher = crypto.createCipheriv('aes-128-ecb', key, null);
  const encrypted = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()]);
  return encrypted.toString('base64');
}
