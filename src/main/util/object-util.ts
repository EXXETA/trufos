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

/**
 * Picks the specified properties from the given object in a type-safe manner. Like {@link Pick}, but
 * with real effect on the object. Works on a copy of the object.
 * @param object The source object.
 * @param properties The properties to pick.
 */
export function pick<T, K extends keyof T>(object: T, ...properties: K[]) {
  const result = {} as Pick<T, K>;
  for (const property of properties) {
    result[property] = object[property];
  }
  return result;
}
