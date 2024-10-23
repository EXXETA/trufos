/**
 * An error that occurs in the main process and is forwarded to the renderer process via the event service.
 */
export class MainProcessError extends Error {
  constructor(message?: string) {
    super(message);
    Reflect.setPrototypeOf(this, MainProcessError.prototype);
    this.name = MainProcessError.name;
  }
}
