/** Whether an error is one of the file system, which has an error code. */
export function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
