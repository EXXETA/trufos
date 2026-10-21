export async function isAsyncEncryptionAvailable(): Promise<boolean> {
  return true;
}

export async function encryptStringAsync(plain: string): Promise<Buffer> {
  return Buffer.from(plain, 'utf-8');
}

export async function decryptStringAsync(
  encrypted: Buffer
): Promise<{ result: string; shouldReEncrypt: boolean }> {
  return { result: encrypted.toString('utf-8'), shouldReEncrypt: false };
}
