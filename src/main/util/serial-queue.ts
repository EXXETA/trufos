const noop = () => {};

/**
 * Runs asynchronous tasks one after another, in the order they were submitted. A task only starts
 * once every task submitted before it has settled; a failing task does not affect the ones after
 * it.
 *
 * A task must not submit another task and wait for it, as that would wait forever.
 */
export class SerialQueue {
  /** Settles when the last submitted task has settled. It never rejects. */
  private tail: Promise<unknown> = Promise.resolve();

  /**
   * Submits a task.
   * @param task runs once every task submitted before it has settled
   * @returns the task's own result
   */
  public run<T>(task: () => Promise<T> | T): Promise<T> {
    const result = this.tail.then(task);
    this.tail = result.then(noop, noop);
    return result;
  }
}
