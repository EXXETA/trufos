import { safeStorage } from 'electron';
import { Buffer } from 'node:buffer';

export class SecretService {
  public static readonly instance = new SecretService();

  public encrypt(plain: string): Buffer {
    try {
      return safeStorage.encryptString(plain);
    } catch {
      return Buffer.from(plain, 'utf-8');
    }
  }

  public decrypt(encrypted: Buffer): string {
    try {
      return safeStorage.decryptString(encrypted);
    } catch {
      return encrypted.toString('utf-8');
    }
  }
}
