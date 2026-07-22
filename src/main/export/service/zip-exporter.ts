import fs from 'node:fs/promises';
import { once } from 'node:events';
import { createWriteStream } from 'node:fs';
import { Readable, Writable } from 'node:stream';
import { configure, TextReader, ZipWriter } from '@zip.js/zip.js';
import type { ExportOptions } from 'shim/event-service';
import { PersistenceService } from 'main/persistence/service/persistence-service';
import { serializeCollection } from 'main/persistence/service/collection-serializer';
import type { CollectionExporter } from './export-service';

// The Electron main process is a plain Node.js environment without DOM Web Workers, so keep zip.js
// compression in-process to avoid it trying to spawn workers.
configure({ useWebWorkers: false });

/** AES key length for encrypted archives: 3 == AES-256 (WinZip-AES). */
const AES_256 = 3;

/**
 * Exports a Trufos collection as a `.zip` archive. The collection is walked into a saved-only
 * snapshot (drafts are never part of it) and serialized through the persistence layer's canonical
 * entry layout, so the archive always matches the current on-disk format. Entries are streamed
 * sequentially, never buffering the whole collection. When a password is provided, the archive is
 * encrypted with AES-256.
 *
 * Secrets are excluded by default. When `includeSecrets` is set, each node's secrets are written
 * into the archive as portable plaintext JSON (independent of the password option).
 */
export class ZipExporter implements CollectionExporter {
  public async exportCollection(
    dirPath: string,
    targetPath: string,
    { includeSecrets = false, password }: ExportOptions = {}
  ): Promise<void> {
    const snapshot = await PersistenceService.instance.walkCollection(dirPath);

    const writeStream = createWriteStream(targetPath);
    const zipWriter = new ZipWriter(Writable.toWeb(writeStream), {
      ...(password ? { password, encryptionStrength: AES_256 } : {}),
    });

    try {
      for await (const entry of serializeCollection(snapshot, { includeSecrets })) {
        const reader =
          typeof entry.data === 'string'
            ? new TextReader(entry.data)
            : (Readable.toWeb(entry.data) as ReadableStream<Uint8Array>);
        await zipWriter.add(entry.path, reader);
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
}
