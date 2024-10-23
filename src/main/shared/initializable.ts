export interface Initializable {
  init(): Promise<void>;
}

/**
 * Check if an object is an instance of {@link Initializable}
 * @param object the object to check
 */
export function isInitializable(object: any): object is Initializable {
  return 'init' in object && typeof object.init === 'function';
}
