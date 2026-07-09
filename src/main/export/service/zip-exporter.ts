import fs from 'node:fs/promises';
import path from 'node:path';
import { createReadStream, createWriteStream } from 'node:fs';
import { once } from 'node:events';
import { Zip, ZipDeflate } from 'fflate';
import { GIT_IGNORE_FILE_NAME } from 'main/persistence/service/info-files/latest';
import { Gitignore } from '../gitignore';
import type { CollectionExporter } from './export-service';

const EMPTY = new Uint8Array(0);

/** The git metadata directory, which `git archive` never includes. */
const GIT_DIR_NAME = '.git';

/**
 * Exports a Trufos collection directory as a `.zip` archive. Like `git archive`, the collection's
 * `.gitignore` decides which paths are excluded (secrets and drafts are ignored there), and the
 * `.git` directory is always omitted. The archive is streamed to disk so it is never fully buffered
 * in memory.
 */
export class ZipExporter implements CollectionExporter {
  public async exportCollection(dirPath: string, targetPath: string): Promise<void> {
    const gitignore = await this.loadGitignore(dirPath);
    const files = await this.collectFiles(dirPath, gitignore);
    const out = createWriteStream(targetPath);

    await new Promise<void>((resolve, reject) => {
      let failed = false;
      const fail = (error: Error) => {
        if (failed) return;
        failed = true;
        out.destroy();
        reject(error);
      };

      out.on('error', fail);

      const zip = new Zip((err, chunk, final) => {
        if (err) return fail(err);
        out.write(chunk);
        if (final) out.end(resolve);
      });

      // Stream every file into the archive sequentially to bound memory usage.
      void (async () => {
        try {
          for (const relativePath of files) {
            const entry = new ZipDeflate(relativePath);
            zip.add(entry);

            const readStream = createReadStream(path.join(dirPath, relativePath));
            for await (const chunk of readStream) {
              entry.push(chunk as Uint8Array);
              if (out.writableNeedDrain) await once(out, 'drain');
            }
            entry.push(EMPTY, true);
          }
          zip.end();
        } catch (error) {
          fail(error as Error);
        }
      })();
    });
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
