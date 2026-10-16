import { app } from 'electron';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/** The name of a temporary file of {@link FileSystemService.replaceFile}. */
const REPLACEMENT_FILE_NAME =
  /^\..+\.[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.tmp$/;

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

  /**
   * Writes a file by writing a temporary file that then replaces it. So readers and a crash see
   * either the old or the new content, never a half-written file, and a stream opened before keeps
   * reading the old content. Unlike the other temporary files, this one has to be next to the
   * target, as only a file of the same volume can replace it. It is a dotfile, see
   * {@link isReplacementFile}.
   * @param filePath the file to write
   * @param data the new content of the file
   */
  public async replaceFile(filePath: string, data: string): Promise<void> {
    const { dir, base } = path.parse(filePath);
    const tempFilePath = path.join(dir, `.${base}.${randomUUID()}.tmp`);
    try {
      await fs.promises.writeFile(tempFilePath, data);
      await fs.promises.rename(tempFilePath, filePath);
    } catch (error) {
      await fs.promises.rm(tempFilePath, { force: true });
      throw error;
    }
  }

  /**
   * Returns true if the file name is the one of a temporary file of {@link replaceFile}.
   * @param fileName the name of the file, without its directory
   */
  public isReplacementFile(fileName: string): boolean {
    return REPLACEMENT_FILE_NAME.test(fileName);
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
}
