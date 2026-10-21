import { Cipheriv, createCipheriv, createDecipheriv, randomBytes, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { pipeline, Readable, Writable } from 'node:stream';
import { pipeline as pipelineAsync } from 'node:stream/promises';
import { FileSystemService } from 'main/filesystem/filesystem-service';
import type { HttpHeaders } from 'shim/objects/headers';

const fileSystemService = FileSystemService.instance;

/**
 * Bodies are encrypted with AES-256-CTR. It is a stream cipher, so an encrypted file is exactly as
 * large as its body and can be read partially. It is not authenticated, which is fine here: the
 * goal is that body files left behind, e.g. by a crash, cannot be read.
 */
const CIPHER = 'aes-256-ctr';

interface StoredBodyEntry {
  filePath: string;
  /** The headers sent with the body, e.g. to suggest a file name when it is downloaded. */
  headers: HttpHeaders;
  /** The initialization vector the file is encrypted with. */
  iv: Buffer;
  /** Set while the body is written. The file is deleted once writing ended. */
  writer?: EncryptingFileWriter;
  /** The number of bytes written so far. */
  size: number;
  /** How many owners keep the body alive, see {@link BodyStore.retain}. */
  references: number;
}

/**
 * Keeps the request and response bodies of the current session as temporary files. The files are
 * encrypted with a key that only exists in memory for this session, as bodies commonly contain
 * secrets. Any file left behind, e.g. by a crash, can never be decrypted again.
 *
 * Owners of a body, like the request history, {@link retain} it while they need it and
 * {@link release} it afterwards. A body is deleted once its last owner released it. All body files
 * are temporary files of the session, so the ones left are deleted when the app quits.
 */
export class BodyStore {
  public static readonly instance = new BodyStore();

  private readonly bodies = new Map<string, StoredBodyEntry>();

  private readonly key = randomBytes(32);

  private constructor() {}

  /**
   * Creates a body. It can be referenced by its ID right away, while it is still written.
   * @param headers the headers sent with the body
   * @returns the ID of the body and the stream to write it to. The stream finishes once the body
   * was written to disk.
   */
  public create(headers: HttpHeaders = {}): { id: string; stream: Writable } {
    const id = randomUUID();
    const file = fileSystemService.temporaryFile();
    const iv = randomBytes(16);
    const writer = new EncryptingFileWriter(
      fs.createWriteStream('', { fd: file.fd }),
      createCipheriv(CIPHER, this.key, iv)
    );
    const entry: StoredBodyEntry = {
      filePath: file.name,
      headers,
      iv,
      writer,
      size: 0,
      references: 0,
    };
    this.bodies.set(id, entry);
    writer.on('written', (bytes) => (entry.size += bytes));
    writer.on('close', () => (entry.writer = undefined));
    return { id, stream: writer };
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
    const entry = this.bodies.get(id);
    if (entry == null) return;

    const decipher = createDecipheriv(CIPHER, this.key, entry.iv);
    if (options.encoding != null) decipher.setEncoding(options.encoding);
    // errors reach the consumer through the returned stream
    return pipeline(fs.createReadStream(entry.filePath, { end: options.end }), decipher, () => {});
  }

  /**
   * @param id the ID of the body
   * @returns the headers sent with the body, or `undefined` if no body with this ID exists
   */
  public getHeaders(id: string): HttpHeaders | undefined {
    return this.bodies.get(id)?.headers;
  }

  /**
   * @param id the ID of the body
   * @returns the size of the body in bytes so far, or `undefined` if no body with this ID exists
   */
  public getSize(id: string): number | undefined {
    return this.bodies.get(id)?.size;
  }

  /**
   * Keeps a body alive until {@link release} is called for it.
   * @param id the ID of the body
   */
  public retain(id: string): void {
    const entry = this.bodies.get(id);
    if (entry != null) entry.references++;
  }

  /**
   * Gives up a reference taken with {@link retain}. The body is deleted once no owner is left.
   * @param id the ID of the body
   */
  public release(id: string): void {
    const entry = this.bodies.get(id);
    if (entry == null) return;
    entry.references--;
    if (entry.references <= 0) this.remove(id);
  }

  /**
   * Saves the decrypted body to a file, e.g. one the user chose.
   * @param id the ID of the body
   * @param filePath the path of the file
   * @returns the path of the file, or `null` if the body does not exist
   */
  public async saveTo(id: string, filePath: string): Promise<string | null> {
    const body = this.openBody(id);
    if (!body) {
      logger.warn(`Body not found for ID: ${id}`);
      return null;
    }

    await pipelineAsync(body, fs.createWriteStream(filePath));
    logger.info(`Body saved to ${filePath}`);
    return filePath;
  }

  /**
   * Deletes a body regardless of its owners, e.g. one that could not be written completely. A body
   * that is still written is deleted once writing ended, as an open file cannot be deleted on every
   * platform.
   * @param id the ID of the body
   */
  public remove(id: string): void {
    const entry = this.bodies.get(id);
    if (entry == null) return;
    this.bodies.delete(id);
    if (entry.writer != null) {
      entry.writer.once('close', () => deleteFileIfExists(entry.filePath));
    } else {
      deleteFileIfExists(entry.filePath);
    }
    logger.debug(`Removed body: ${id}`);
  }

  /**
   * Forgets all bodies when the app quits. Their files are deleted together with all other
   * temporary files of the session, see {@link FileSystemService.deleteTemporaryFiles}.
   */
  public shutdown(): void {
    this.bodies.clear();
    logger.debug('BodyStore shut down');
  }
}

/**
 * Encrypts everything written to it into a file. Emits `written` with the number of bytes of each
 * written chunk. Finishes once the file was written and closed.
 */
class EncryptingFileWriter extends Writable {
  constructor(
    private readonly file: fs.WriteStream,
    private readonly cipher: Cipheriv
  ) {
    super();
    file.on('error', (error) => this.destroy(error));
  }

  _write(chunk: Buffer, _encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
    this.file.write(this.cipher.update(chunk), (error) => {
      if (error == null) this.emit('written', chunk.length);
      callback(error);
    });
  }

  _final(callback: (error?: Error | null) => void): void {
    // wait for the file to be closed, not only flushed, so it can be deleted right away
    this.file.once('close', () => callback());
    this.file.end(this.cipher.final());
  }

  _destroy(error: Error | null, callback: (error?: Error | null) => void): void {
    if (this.file.closed) return callback(error);
    this.file.once('close', () => callback(error));
    this.file.destroy();
  }
}

function deleteFileIfExists(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      logger.debug(`Deleted temporary body file: ${filePath}`);
    }
  } catch (error) {
    logger.error(`Failed to delete body file ${filePath}:`, error);
  }
}
