import { Cipheriv, createCipheriv, createDecipheriv, randomBytes, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { pipeline, Readable } from 'node:stream';
import { pipeline as pipelineAsync } from 'node:stream/promises';
import type { HttpHeaders } from 'shim/headers';

/**
 * Bodies are encrypted with AES-256-CTR. It is a stream cipher, so an encrypted file is exactly as
 * large as its body and can be read partially. It is not authenticated, which is fine here: the
 * goal is that body files left behind, e.g. by a crash, cannot be read.
 */
const CIPHER = 'aes-256-ctr';

export interface ResponseBodyEntry {
  filePath: string;
  headers: HttpHeaders;
}

/**
 * Keeps the request and response bodies of the current session as temporary files. The files are
 * encrypted with a key that only exists in memory for this session, as bodies commonly contain
 * secrets. Files are deleted when the app closes; any left behind can never be decrypted again.
 */
export class ResponseBodyService {
  public static readonly instance = new ResponseBodyService();

  private readonly responseBodyMap = new Map<string, ResponseBodyEntry>();

  private readonly key = randomBytes(32);

  /** filePath => the initialization vector the file is encrypted with */
  private readonly ivs = new Map<string, Buffer>();

  private constructor() {}

  /**
   * Creates the cipher to encrypt a body file with. Each file gets its own initialization vector,
   * so no two files share a keystream.
   * @param filePath the file the encrypted body is written to
   */
  public createCipher(filePath: string): Cipheriv {
    const iv = randomBytes(16);
    this.ivs.set(filePath, iv);
    return createCipheriv(CIPHER, this.key, iv);
  }

  /**
   * Opens a stored body for reading. All body files must be read through this method, as they are
   * encrypted.
   * @param id the ID of the body
   * @param options the encoding of the returned chunks, and the offset of the last byte to read
   * @returns the decrypted body, or `undefined` if no body with this ID exists
   */
  public openBody(
    id: string,
    options: { encoding?: BufferEncoding; end?: number } = {}
  ): Readable | undefined {
    const filePath = this.getFilePath(id);
    const iv = filePath != null ? this.ivs.get(filePath) : undefined;
    if (filePath == null || iv == null) return;

    const decipher = createDecipheriv(CIPHER, this.key, iv);
    if (options.encoding != null) decipher.setEncoding(options.encoding);
    // errors reach the consumer through the returned stream
    return pipeline(fs.createReadStream(filePath, { end: options.end }), decipher, () => {});
  }

  public register(filePath: string, headers: HttpHeaders = {}): string {
    const responseId = randomUUID();
    this.responseBodyMap.set(responseId, { filePath, headers });
    logger.debug(`Registered response body: ${responseId} -> ${filePath}`);
    return responseId;
  }

  public getFilePath(responseId: string): string | undefined {
    return this.responseBodyMap.get(responseId)?.filePath;
  }

  public getEntry(responseId: string): ResponseBodyEntry | undefined {
    return this.responseBodyMap.get(responseId);
  }

  public async downloadResponse(responseId: string, chosenPath: string): Promise<string | null> {
    const body = this.openBody(responseId);
    if (!body) {
      logger.warn(`Response body not found for ID: ${responseId}`);
      return null;
    }

    await pipelineAsync(body, fs.createWriteStream(chosenPath));
    logger.info(`Response body saved to ${chosenPath}`);
    return chosenPath;
  }

  public remove(responseId: string): void {
    const entry = this.responseBodyMap.get(responseId);
    if (entry) {
      this.deleteFileIfExists(entry.filePath);
      this.responseBodyMap.delete(responseId);
      logger.debug(`Removed response body: ${responseId}`);
    }
  }

  public clear(): void {
    this.responseBodyMap.forEach((entry) => {
      this.deleteFileIfExists(entry.filePath);
    });
    this.responseBodyMap.clear();
    logger.debug('Cleared all response bodies');
  }

  public shutdown(): void {
    this.clear();
    logger.debug('ResponseBodyService shut down');
  }

  private deleteFileIfExists(filePath: string): void {
    this.ivs.delete(filePath);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        logger.debug(`Deleted temporary response file: ${filePath}`);
      }
    } catch (error) {
      logger.error(`Failed to delete response file ${filePath}:`, error);
    }
  }
}
