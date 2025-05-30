export function encryptString(plain: string): Buffer {
  return Buffer.from(plain, 'utf-8');
}

export function decryptString(encrypted: Buffer): string {
  return encrypted.toString('utf-8');
}
