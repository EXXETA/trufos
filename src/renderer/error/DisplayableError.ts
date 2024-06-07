// TODO: localize the error messages
/**
 * An error that can be displayed to the user as toast. It has a title and a description.
 */
export class DisplayableError extends Error {

  public static readonly DEFAULT_TITLE = "Unexpected Error";
  public static readonly DEFAULT_DESCRIPTION = "See the console for more information.";

  constructor(public readonly description: string, public readonly title = DisplayableError.DEFAULT_TITLE, public readonly cause?: any) {
    super(description);
    Reflect.setPrototypeOf(this, DisplayableError.prototype);
    this.name = DisplayableError.name;
  }
}
