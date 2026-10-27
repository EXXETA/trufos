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
   * @param options the encoding of the returned chunks, and the offsets of the first and the last
   * byte to read
   * @returns the decrypted body, or `undefined` if no body with this ID exists
   */
  public openBody(
    id: string,
    options: { encoding?: BufferEncoding; start?: number; end?: number } = {}
  ): Readable | undefined {
    const entry = this.bodies.get(id);
    if (entry == null) return;

    const { start = 0, end } = options;
    // CTR encrypts each block with the IV plus the block's index as counter, so decrypting can
    // start at the block of `start`, skipping the key stream of the bytes before it in that block
    const decipher = createDecipheriv(CIPHER, this.key, addToCounter(entry.iv, start >> 4));
    decipher.update(Buffer.alloc(start & 15));
    if (options.encoding != null) decipher.setEncoding(options.encoding);
    // errors reach the consumer through the returned stream
    const file = fs.createReadStream(entry.filePath, { start, end });
    return pipeline(file, decipher, () => {});
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
   * @param options `exclusive` fails if the file exists instead of replacing it
   * @returns the path of the file, or `null` if the body does not exist
   */
  public async saveTo(
    id: string,
    filePath: string,
    options: { exclusive?: boolean } = {}
  ): Promise<string | null> {
    const body = this.openBody(id);
    if (!body) {
      logger.warn(`Body not found for ID: ${id}`);
      return null;
    }

    const flags = options.exclusive === true ? 'wx' : 'w';
    await pipelineAsync(body, fs.createWriteStream(filePath, { flags }));
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

/**
 * Adds to the counter of an AES-CTR initialization vector, a 128-bit big-endian integer that
 * wraps around.
 * @param iv the initialization vector
 * @param blocks the number of blocks to add
 * @returns the initialization vector of the given block
 */
function addToCounter(iv: Buffer, blocks: number): Buffer {
  const counter = (BigInt(`0x${iv.toString('hex')}`) + BigInt(blocks)) % (1n << 128n);
  return Buffer.from(counter.toString(16).padStart(32, '0'), 'hex');
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
