/**
 * Modifies the given object by deleting the specified properties in a type-safe manner. Like
 * {@link Omit}, but with real effect on the object.
 * @param object The object to modify.
 * @param properties The properties to delete.
 */
export function omit<T, K extends keyof T>(object: T, ...properties: K[]) {
  for (const property of properties) {
    delete object[property];
  }
  return object as Omit<T, K>;
}
