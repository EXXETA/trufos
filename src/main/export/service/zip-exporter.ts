import fs from 'node:fs/promises';
import path from 'node:path';
import { once } from 'node:events';
import { createReadStream, createWriteStream } from 'node:fs';
import { Readable, Writable } from 'node:stream';
import { configure, TextReader, ZipWriter } from '@zip.js/zip.js';
import type { ExportOptions } from 'shim/event-service';
import { GIT_IGNORE_FILE_NAME } from 'main/persistence/service/info-files/latest';
import { SECRETS_FILE_NAME } from 'main/persistence/constants';
import { SecretService } from 'main/persistence/service/secret-service';
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
 *
 * Secrets (`.secrets.bin` files) are excluded by default. When `includeSecrets` is set, each is
 * decrypted from its machine-bound `safeStorage` form and written into the archive as plaintext
 * JSON so it is portable to other machines. This is independent of the password option.
 */
export class ZipExporter implements CollectionExporter {
  public async exportCollection(
    dirPath: string,
    targetPath: string,
    { includeSecrets = false, password }: ExportOptions = {}
  ): Promise<void> {
    const gitignore = await this.loadGitignore(dirPath);
    const files = await this.collectFiles(dirPath, gitignore, includeSecrets);

    const writeStream = createWriteStream(targetPath);
    const zipWriter = new ZipWriter(Writable.toWeb(writeStream), {
      ...(password ? { password, encryptionStrength: AES_256 } : {}),
    });

    try {
      // Stream every file into the archive sequentially to bound memory usage.
      for (const relativePath of files) {
        const absolutePath = path.join(dirPath, relativePath);
        if (includeSecrets && path.basename(relativePath) === SECRETS_FILE_NAME) {
          // Decrypt the machine-bound secrets and store them as portable plaintext JSON.
          const plaintext = SecretService.instance.decrypt(await fs.readFile(absolutePath));
          await zipWriter.add(relativePath, new TextReader(plaintext));
        } else {
          const readable = Readable.toWeb(
            createReadStream(absolutePath)
          ) as ReadableStream<Uint8Array>;
          await zipWriter.add(relativePath, readable);
        }
      }
      await zipWriter.close();
    } catch (error) {
      if (!writeStream.destroyed) {
        writeStream.destroy();
        await once(writeStream, 'close').catch(() => {});
      }
      await fs.rm(targetPath, { force: true }).catch((cleanupError) => {
        logger.warn(`Failed to delete partial export at "${targetPath}": ${cleanupError}`);
      });
      throw error;
    }
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
   * `.git` directory and anything ignored by the collection's `.gitignore`. When `includeSecrets`
   * is set, `.secrets.bin` files are kept even though they are `.gitignore`d.
   */
  private async collectFiles(
    dirPath: string,
    gitignore: Gitignore,
    includeSecrets: boolean
  ): Promise<string[]> {
    const files: string[] = [];

    const walk = async (currentDir: string, relativeDir: string) => {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === GIT_DIR_NAME) continue;
        const relativePath = relativeDir === '' ? entry.name : `${relativeDir}/${entry.name}`;
        const keep = includeSecrets && entry.name === SECRETS_FILE_NAME;
        if (gitignore.ignores(relativePath) && !keep) continue;
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
