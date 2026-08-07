export interface Initializable {
  init(): Promise<void>;
}

/**
 * Check if an object is an instance of {@link Initializable}
 * @param object the object to check
 */
export function isInitializable(object: unknown): object is Initializable {
  return (
    typeof object === 'object' &&
    object !== null &&
    'init' in object &&
    typeof object.init === 'function'
  );
}
