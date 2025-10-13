import { randomUUID } from 'node:crypto';
import fs from 'node:fs';

export class ResponseBodyService {
  public static readonly instance = new ResponseBodyService();

  private readonly responseBodyMap = new Map<string, string>();

  private constructor() {}

  public register(filePath: string): string {
    const responseId = randomUUID();
    this.responseBodyMap.set(responseId, filePath);
    logger.debug(`Registered response body: ${responseId} -> ${filePath}`);
    return responseId;
  }

  public getFilePath(responseId: string): string | undefined {
    return this.responseBodyMap.get(responseId);
  }

  public remove(responseId: string): void {
    const filePath = this.responseBodyMap.get(responseId);
    if (filePath) {
      this.deleteFileIfExists(filePath);
      this.responseBodyMap.delete(responseId);
      logger.debug(`Removed response body: ${responseId}`);
    }
  }

  public clear(): void {
    this.responseBodyMap.forEach((filePath) => {
      this.deleteFileIfExists(filePath);
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
