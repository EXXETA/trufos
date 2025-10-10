import { randomUUID } from 'node:crypto';
import fs from 'node:fs';

interface ResponseEntry {
  filePath: string;
  timestamp: number;
}

export class ResponseBodyService {
  public static readonly instance = new ResponseBodyService();

  private readonly responseBodyMap = new Map<string, ResponseEntry>();
  private cleanupInterval?: NodeJS.Timeout;

  private readonly CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
  private readonly EXPIRATION_TIME_MS = 60 * 60 * 1000;

  private constructor() {
    this.startCleanupTimer();
  }

  public register(filePath: string): string {
    const responseId = randomUUID();
    this.responseBodyMap.set(responseId, {
      filePath,
      timestamp: Date.now(),
    });
    logger.debug(`Registered response body: ${responseId} -> ${filePath}`);
    return responseId;
  }

  public getFilePath(responseId: string): string | undefined {
    const entry = this.responseBodyMap.get(responseId);
    if (entry) {
      entry.timestamp = Date.now();
      return entry.filePath;
    }
    return undefined;
  }

  public remove(responseId: string): void {
    const entry = this.responseBodyMap.get(responseId);
    if (entry) {
      this.deleteFileIfExists(entry.filePath);
      this.responseBodyMap.delete(responseId);
      logger.debug(`Removed response body: ${responseId}`);
    }
  }

  public clear(): void {
    this.responseBodyMap.forEach((entry) => {
      this.deleteFileIfExists(entry.filePath);
    });
    this.responseBodyMap.clear();
    logger.debug('Cleared all response bodies');
  }

  public shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
    this.clear();
    logger.debug('ResponseBodyService shut down');
  }

  private startCleanupTimer(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredEntries();
    }, this.CLEANUP_INTERVAL_MS);

    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }

    logger.debug(
      `Started cleanup timer (interval: ${this.CLEANUP_INTERVAL_MS}ms, expiration: ${this.EXPIRATION_TIME_MS}ms)`
    );
  }

  private cleanupExpiredEntries(): void {
    const now = Date.now();
    const expiredIds: string[] = [];

    this.responseBodyMap.forEach((entry, responseId) => {
      if (now - entry.timestamp > this.EXPIRATION_TIME_MS) {
        expiredIds.push(responseId);
      }
    });

    if (expiredIds.length > 0) {
      logger.info(`Cleaning up ${expiredIds.length} expired response bodies`);
      expiredIds.forEach((id) => this.remove(id));
    }
  }

  private deleteFileIfExists(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        logger.debug(`Deleted temporary response file: ${filePath}`);
      }
    } catch (error) {
      logger.error(`Failed to delete response file ${filePath}:`, error);
    }
  }
}
