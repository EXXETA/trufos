// TODO: localize the error messages

/** The shape a {@link DisplayableError} takes when serialized for transport over IPC. */
export type SerializedDisplayableError = {
  __displayableError: true;
  title: string;
  description: string;
};

/**
 * An error that can be displayed to the user as toast. It has a title and a description.
 *
 * This error can be thrown in either the main or the renderer process. To forward it from the main
 * process to the renderer via IPC, use {@link serialize} on the main side and
 * {@link deserialize} on the renderer side, since only plain data survives structured cloning.
 */
export class DisplayableError extends Error {
  public static readonly DEFAULT_TITLE = 'Unexpected Error';
  public static readonly DEFAULT_DESCRIPTION = 'See the console for more information.';

  constructor(
    public readonly description: string,
    public readonly title = DisplayableError.DEFAULT_TITLE,
    public readonly cause?: unknown
  ) {
    super(description);
    Reflect.setPrototypeOf(this, DisplayableError.prototype);
    this.name = DisplayableError.name;
  }

  /**
   * Convert this error into a plain object that can be sent over IPC. The {@link cause} is dropped
   * on purpose because it may contain non-cloneable values and is only relevant for local logging.
   */
  public serialize(): SerializedDisplayableError {
    return { __displayableError: true, title: this.title, description: this.description };
  }

  /** Type guard that checks whether the given value is a {@link SerializedDisplayableError}. */
  public static isSerialized(value: unknown): value is SerializedDisplayableError {
    return (
      typeof value === 'object' &&
      value !== null &&
      (value as Partial<SerializedDisplayableError>).__displayableError === true
    );
  }

  /** Reconstruct a {@link DisplayableError} from its {@link SerializedDisplayableError} form. */
  public static deserialize(value: SerializedDisplayableError): DisplayableError {
    return new DisplayableError(value.description, value.title);
  }
}
