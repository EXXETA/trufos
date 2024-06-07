export enum InternalErrorType {
  UNKNOWN = 'UNKNOWN',
  COLLECTION_LOAD_ERROR = 'COLLECTION_LOAD_ERROR',
  COLLECTION_SAVE_ERROR = 'COLLECTION_SAVE_ERROR',
  UNSUPPORTED_IMPORT_STRATEGY = 'UNSUPPORTED_IMPORT_STRATEGY',
}

export class InternalError extends Error {
  constructor(public readonly type: InternalErrorType, message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'InternalError';
  }
}
