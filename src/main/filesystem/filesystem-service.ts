import { app } from 'electron';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/** A temporary file opened for writing. */
export interface TemporaryFile {
  name: string;
  fd: number;
}

/**
 * Singleton service for file system operations
 */
export class FileSystemService {
  public static readonly instance = new FileSystemService();

  private static readonly _tempDir = app?.getPath('temp') ?? '';

  /** The directory of this session's temporary files, see {@link temporaryDirectory}. */
  private _sessionDirectory?: string;

  /**
   * The directory all temporary files of this app session are kept in. It is created on first use,
   * is only accessible by the current user and is deleted when the app quits, see
   * {@link deleteTemporaryFiles}.
   */
  public get temporaryDirectory(): string {
    if (this._sessionDirectory == null || !fs.existsSync(this._sessionDirectory)) {
      // mkdtemp creates the directory with mode 0o700
      this._sessionDirectory = fs.mkdtempSync(path.join(FileSystemService._tempDir, 'trufos-'));
    }
    return this._sessionDirectory;
  }

  /**
   * Create a temporary file in the {@link temporaryDirectory}
   *
   * @returns the temporary file object containing the file descriptor and the file name
   */
  public temporaryFile(): TemporaryFile {
    const name = path.join(this.temporaryDirectory, randomUUID());
    return { name, fd: fs.openSync(name, 'wx', 0o600) };
  }

  /** Deletes the {@link temporaryDirectory} with all temporary files of this session. */
  public deleteTemporaryFiles(): void {
    if (this._sessionDirectory == null) return;
    try {
      fs.rmSync(this._sessionDirectory, { recursive: true, force: true });
    } catch (error) {
      logger.warn('Could not delete the temporary files of this session', error);
    }
    this._sessionDirectory = undefined;
  }

  /**
   * Creates a read stream for the file at the specified path
   * @param filePath the file path
   */
  public async readFile(filePath: string) {
    // fs.createReadStream is not an async function, does not return a promise
    // how does this even work...
    return fs.createReadStream(filePath);
  }
}
