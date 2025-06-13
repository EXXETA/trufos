import { safeStorage } from 'electron';

export class SecretService {
  public static readonly instance = new SecretService();

  /**
   * Encrypts a string using the SafeStorage API.
   * @param plain The string to encrypt.
   */
  public encrypt(plain: string): Buffer {
    return safeStorage.encryptString(plain);
  }

  /**
   * Decrypts a string using the SafeStorage API.
   * @param encrypted The encrypted bytes to decrypt.
   */
  public decrypt(encrypted: Buffer): string {
    return safeStorage.decryptString(encrypted);
  }
}
