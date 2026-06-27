import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { copyFile } from 'node:fs/promises';
import type { HttpHeaders } from 'shim/headers';

export interface ResponseBodyEntry {
  filePath: string;
  headers: HttpHeaders;
}

export class ResponseBodyService {
  public static readonly instance = new ResponseBodyService();

  private readonly responseBodyMap = new Map<string, ResponseBodyEntry>();

  private constructor() {}

  public register(filePath: string, headers: HttpHeaders = {}): string {
    const responseId = randomUUID();
    this.responseBodyMap.set(responseId, { filePath, headers });
    logger.debug(`Registered response body: ${responseId} -> ${filePath}`);
    return responseId;
  }

  public getFilePath(responseId: string): string | undefined {
    return this.responseBodyMap.get(responseId)?.filePath;
  }

  public getEntry(responseId: string): ResponseBodyEntry | undefined {
    return this.responseBodyMap.get(responseId);
  }

  public async downloadResponse(responseId: string, chosenPath: string): Promise<string | null> {
    const entry = this.getEntry(responseId);
    if (!entry) {
      logger.warn(`Response body not found for ID: ${responseId}`);
      return null;
    }

    await copyFile(entry.filePath, chosenPath);
    logger.info(`Response body saved to ${chosenPath}`);
    return chosenPath;
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
    this.clear();
    logger.debug('ResponseBodyService shut down');
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
