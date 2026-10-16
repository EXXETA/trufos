/**
 * Runs the steps of closing the app: waits until the renderer is ready to close, writes all
 * pending changes and finally closes. The pending changes are written and the app is closed even
 * if waiting for the renderer times out or writing fails.
 * @param readyToClose settles when the renderer is ready to close or waiting for it is given up
 * @param flush writes all pending changes of the collection
 * @param close closes the window and quits the app
 */
export async function closeAfterFlush(
  readyToClose: Promise<unknown>,
  flush: () => Promise<void>,
  close: () => void
): Promise<void> {
  try {
    await readyToClose;
  } catch (error) {
    logger.warn('The renderer did not get ready to close in time, closing anyway:', error);
  }

  try {
    await flush();
  } catch (error) {
    logger.error('Failed to write the pending changes before closing:', error);
  } finally {
    close();
  }
}
