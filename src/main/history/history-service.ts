import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { HistoryEntry } from 'shim/objects/history';
import { TrufosRequest, TrufosResponse } from 'shim';
import { buildUrl } from 'shim/objects/url';
import { EnvironmentService } from 'main/environment/service/environment-service';
import { exists } from 'main/util/fs-util';

const SENSITIVE_HEADERS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'proxy-authorization',
]);

const MAX_HISTORY_ENTRIES = 100;

export class HistoryService {
  public static readonly instance = new HistoryService();

  private constructor() {}

  private getHistoryDir(collectionDirPath: string): string {
    return path.join(collectionDirPath, '.history');
  }

  /**
   * Deletes the history of all given collections. Called once on app startup so
   * the history is ephemeral per session and its schema can change freely
   * without needing migrations.
   * @param collectionDirPaths The directories of all known collections.
   */
  public async clearOnStartup(collectionDirPaths: string[]): Promise<void> {
    for (const dirPath of collectionDirPaths) {
      try {
        await fs.rm(this.getHistoryDir(dirPath), { recursive: true, force: true });
      } catch (error) {
        logger.warn(`Failed to clear history of collection at ${dirPath}:`, error);
      }
    }
  }

  /**
   * Records a request/response entry in the history.
   * Redacts sensitive headers and limits body/response size.
   */
  public async recordEntry(
    request: TrufosRequest,
    responseOrError: TrufosResponse | { error: string; duration: number }
  ): Promise<void> {
    try {
      const collection = EnvironmentService.instance.currentCollection;
      if (!collection || !collection.dirPath) {
        return;
      }

      const historyDir = this.getHistoryDir(collection.dirPath);
      await fs.mkdir(historyDir, { recursive: true });

      // Redact sensitive headers
      const redactedHeaders = request.headers.map((h) => {
        const keyLower = h.key.toLowerCase();
        if (SENSITIVE_HEADERS.has(keyLower)) {
          return { ...h, value: '***REDACTED***' };
        }
        return h;
      });

      // Get body summary if text body
      let bodySummary: string | undefined;
      if (request.body && request.body.type === 'text' && request.body.text) {
        bodySummary =
          request.body.text.length > 500
            ? request.body.text.substring(0, 500) + '...'
            : request.body.text;
      }

      const isError = 'error' in responseOrError;
      const entry: HistoryEntry = {
        id: randomUUID(),
        timestamp: Date.now(),
        request: {
          url: buildUrl(request.url),
          method: request.method,
          headers: redactedHeaders,
          bodySummary,
        },
        response: {
          status: isError ? 0 : responseOrError.metaInfo.status,
          duration: isError
            ? responseOrError.duration
            : Math.round(responseOrError.metaInfo.duration),
          size: isError ? 0 : responseOrError.metaInfo.size.totalSizeInBytes,
          error: isError ? responseOrError.error : undefined,
        },
        sourceRequestId: request.id,
        sourceRequestTitle: request.title,
      };

      const filename = `${entry.timestamp}_${entry.id}.json`;
      await fs.writeFile(path.join(historyDir, filename), JSON.stringify(entry, null, 2), 'utf8');

      // Apply retention policy (enforce MAX_HISTORY_ENTRIES limit)
      await this.enforceRetentionLimit(historyDir);
    } catch (error) {
      logger.error('Failed to record history entry:', error);
    }
  }

  /**
   * Loads history entries for the current collection, newest first.
   */
  public async loadEntries(limit = MAX_HISTORY_ENTRIES): Promise<HistoryEntry[]> {
    try {
      const collection = EnvironmentService.instance.currentCollection;
      if (!collection || !collection.dirPath) {
        return [];
      }

      const historyDir = this.getHistoryDir(collection.dirPath);
      if (!(await exists(historyDir))) {
        return [];
      }

      const files = await fs.readdir(historyDir);
      const jsonFiles = files.filter((f) => f.endsWith('.json'));

      const entries: HistoryEntry[] = [];
      for (const file of jsonFiles) {
        try {
          const content = await fs.readFile(path.join(historyDir, file), 'utf8');
          entries.push(HistoryEntry.parse(JSON.parse(content)));
        } catch (e) {
          logger.error(`Failed to parse history file ${file}:`, e);
        }
      }

      // Sort newest first
      entries.sort((a, b) => b.timestamp - a.timestamp);

      return entries.slice(0, limit);
    } catch (error) {
      logger.error('Failed to load history entries:', error);
      return [];
    }
  }

  /**
   * Clears all history entries for the current collection.
   */
  public async clearHistory(): Promise<void> {
    try {
      const collection = EnvironmentService.instance.currentCollection;
      if (!collection || !collection.dirPath) {
        return;
      }

      const historyDir = this.getHistoryDir(collection.dirPath);
      if (await exists(historyDir)) {
        await fs.rm(historyDir, { recursive: true, force: true });
      }
    } catch (error) {
      logger.error('Failed to clear history:', error);
    }
  }

  private async enforceRetentionLimit(historyDir: string): Promise<void> {
    try {
      const files = await fs.readdir(historyDir);
      const jsonFiles = files.filter((f) => f.endsWith('.json'));
      if (jsonFiles.length <= MAX_HISTORY_ENTRIES) {
        return;
      }

      // Parse and sort files by timestamp from file name or stat
      const filesWithTimestamp = jsonFiles.map((file) => {
        const parts = file.split('_');
        const timestamp = parseInt(parts[0], 10);
        return { file, timestamp: isNaN(timestamp) ? 0 : timestamp };
      });

      filesWithTimestamp.sort((a, b) => b.timestamp - a.timestamp); // newest first

      // Delete files beyond the limit
      const filesToDelete = filesWithTimestamp.slice(MAX_HISTORY_ENTRIES);
      for (const item of filesToDelete) {
        await fs.unlink(path.join(historyDir, item.file));
      }
    } catch (e) {
      logger.warn('Failed to enforce history retention limit:', e);
    }
  }
}
