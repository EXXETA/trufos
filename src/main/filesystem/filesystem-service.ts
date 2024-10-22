import tmp from 'tmp';
import { app } from 'electron';
import fs from 'node:fs';

/**
 * Singleton service for file system operations
 */
export class FileSystemService {

  private static readonly _instance: FileSystemService = new FileSystemService();
  private static readonly _tempDir = app?.getPath('temp') ?? '';

  constructor() {

  }

  public static get instance() {
    return this._instance;
  }

  /**
   * Create a temporary file
   *
   * @returns the temporary file object containing the file descriptor and the file name
   */
  public temporaryFile() {
    return tmp.fileSync({ dir: FileSystemService._tempDir });
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
