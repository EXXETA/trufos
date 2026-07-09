import fs from 'node:fs/promises';
import path from 'node:path';
import { createReadStream, createWriteStream } from 'node:fs';
import { Readable, Writable } from 'node:stream';
import { configure, ZipWriter } from '@zip.js/zip.js';
import type { ExportOptions } from 'shim/event-service';
import { GIT_IGNORE_FILE_NAME } from 'main/persistence/service/info-files/latest';
import { Gitignore } from '../gitignore';
import type { CollectionExporter } from './export-service';

// The Electron main process is a plain Node.js environment without DOM Web Workers, so keep zip.js
// compression in-process to avoid it trying to spawn workers.
configure({ useWebWorkers: false });

/** AES key length for encrypted archives: 3 == AES-256 (WinZip-AES). */
const AES_256 = 3;

/** The git metadata directory, which `git archive` never includes. */
const GIT_DIR_NAME = '.git';

/**
 * Exports a Trufos collection directory as a `.zip` archive. Like `git archive`, the collection's
 * `.gitignore` decides which paths are excluded (secrets and drafts are ignored there), and the
 * `.git` directory is always omitted. The archive is streamed to disk so it is never fully buffered
 * in memory. When a password is provided, the archive is encrypted with AES-256.
 */
export class ZipExporter implements CollectionExporter {
  public async exportCollection(
    dirPath: string,
    targetPath: string,
    options?: ExportOptions
  ): Promise<void> {
    const gitignore = await this.loadGitignore(dirPath);
    const files = await this.collectFiles(dirPath, gitignore);

    const password = options?.password;
    const zipWriter = new ZipWriter(Writable.toWeb(createWriteStream(targetPath)), {
      ...(password ? { password, encryptionStrength: AES_256 } : {}),
    });

    // Stream every file into the archive sequentially to bound memory usage.
    for (const relativePath of files) {
      const readable = Readable.toWeb(
        createReadStream(path.join(dirPath, relativePath))
      ) as ReadableStream<Uint8Array>;
      await zipWriter.add(relativePath, readable);
    }
    await zipWriter.close();
  }

  /** Loads the collection's `.gitignore`, falling back to an empty matcher when absent. */
  private async loadGitignore(dirPath: string): Promise<Gitignore> {
    try {
      return new Gitignore(await fs.readFile(path.join(dirPath, GIT_IGNORE_FILE_NAME), 'utf8'));
    } catch {
      return new Gitignore('');
    }
  }

  /**
   * Recursively collects the POSIX-style relative paths of all files under `dirPath`, pruning the
   * `.git` directory and anything ignored by the collection's `.gitignore`.
   */
  private async collectFiles(dirPath: string, gitignore: Gitignore): Promise<string[]> {
    const files: string[] = [];

    const walk = async (currentDir: string, relativeDir: string) => {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === GIT_DIR_NAME) continue;
        const relativePath = relativeDir === '' ? entry.name : `${relativeDir}/${entry.name}`;
        if (gitignore.ignores(relativePath)) continue;
        if (entry.isDirectory()) {
          await walk(path.join(currentDir, entry.name), relativePath);
        } else if (entry.isFile()) {
          files.push(relativePath);
        }
      }
    };

    await walk(dirPath, '');
    return files;
  }
}
