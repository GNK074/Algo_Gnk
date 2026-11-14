import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateSecret() {
  const bits = Array.from(randomBytes(20), byte => byte.toString(2).padStart(8, '0')).join('');
  return bits.match(/.{5}/g)!.map(group => alphabet[parseInt(group, 2)]).join('');
}

function key() {
  const value = process.env.GNK_MFA_KEY ?? '';
  if (!/^[a-f0-9]{64}$/i.test(value)) throw new Error('GNK_MFA_KEY must contain 32 hex-encoded bytes');
  return Buffer.from(value, 'hex');
}

export function encryptSecret(secret: string, userId: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  cipher.setAAD(Buffer.from(userId));
  const ciphertext = Buffer.concat([cipher.update(secret, 'ascii'), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map(value => value.toString('hex')).join('.');
}

export function decryptSecret(value: string, userId: string) {
  const [iv, tag, ciphertext] = value.split('.').map(part => Buffer.from(part, 'hex'));
  const decipher = createDecipheriv('aes-256-gcm', key(), iv);
  decipher.setAAD(Buffer.from(userId));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('ascii');
}

export function matchingCounter(secret: string, code: string, now = Date.now()) {
  if (!/^[0-9]{6}$/.test(code) || !/^[A-Z2-7]{32}$/.test(secret)) return null;
  const bits = Array.from(secret, char => alphabet.indexOf(char).toString(2).padStart(5, '0')).join('');
  const bytes = Buffer.from(bits.match(/.{8}/g)!.map(group => parseInt(group, 2)));
  const current = BigInt(Math.floor(now / 30000));
  for (const offset of [0n, -1n, 1n]) {
    const counter = current + offset;
    if (counter < 0n) continue;
    const input = Buffer.alloc(8);
    input.writeBigUInt64BE(counter);
    const digest = createHmac('sha1', bytes).update(input).digest();
    const index = digest[digest.length - 1] & 15;
    const expected = String((digest.readUInt32BE(index) & 0x7fffffff) % 1_000_000).padStart(6, '0');
    if (timingSafeEqual(Buffer.from(expected), Buffer.from(code))) return counter;
  }
  return null;
}
