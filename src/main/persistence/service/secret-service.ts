import { safeStorage } from 'electron';
import { Buffer } from 'node:buffer';
import { ZodType } from 'zod';
import { FileSystemService } from 'main/filesystem/filesystem-service';
import { readFileLimited } from 'main/util/fs-util';

const fileSystemService = FileSystemService.instance;

export interface DecryptedSecret {
  plain: string;
  /** The secret encrypted with the current key, if the given bytes used an outdated one. */
  reEncrypted?: Buffer;
}

export class SecretService {
  public static readonly instance = new SecretService();

  /**
   * Encrypts a string using the SafeStorage API.
   * @param plain The string to encrypt.
   */
  public encrypt(plain: string): Promise<Buffer> {
    return safeStorage.encryptStringAsync(plain);
  }

  /**
   * Decrypts a string using the SafeStorage API. If the bytes were encrypted with an outdated key,
   * the secret is encrypted again with the current one, which the caller should store.
   * @param encrypted The encrypted bytes to decrypt.
   */
  public async decrypt(encrypted: Buffer): Promise<DecryptedSecret> {
    const { result, shouldReEncrypt } = await safeStorage.decryptStringAsync(encrypted);
    return {
      plain: result,
      reEncrypted: shouldReEncrypt ? await safeStorage.encryptStringAsync(result) : undefined,
    };
  }

  /**
   * Encrypts the given value as JSON and atomically writes it to a file.
   * @param filePath The file to write.
   * @param value The value to encrypt.
   */
  public async writeJson(filePath: string, value: unknown): Promise<void> {
    await fileSystemService.replaceFile(filePath, await this.encrypt(JSON.stringify(value)));
  }

  /**
   * Reads and decrypts a file written by {@link writeJson}. If it was encrypted with an outdated key,
   * the file is written again with the current one.
   * @param filePath The file to read.
   * @param schema The schema the decrypted JSON is parsed with.
   */
  public async readJson<T>(filePath: string, schema: ZodType<T>): Promise<T> {
    const { plain, reEncrypted } = await this.decrypt(await readFileLimited(filePath));
    if (reEncrypted !== undefined) {
      logger.info('Re-encrypting secrets with the current key in', filePath);
      await fileSystemService.replaceFile(filePath, reEncrypted);
    }
    return schema.parse(JSON.parse(plain));
  }
}
