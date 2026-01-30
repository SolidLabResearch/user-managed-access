import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// Used to convert stored identifiers into aggregate identifiers.
// This way we don't need to store mappings between derived and actual identifiers.
const key = randomBytes(32);
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';

export async function encodeAggregateId(id: string): Promise<string> {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
  let encrypted = cipher.update(id, 'utf8', 'hex') + cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export async function decodeAggregateId(payload: string): Promise<string> {
  const [ ivHex, authTagHex, encrypted ] = payload.split(':');
  const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  return decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8');
}
