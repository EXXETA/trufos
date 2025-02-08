/**
 * Modifies the given object by deleting the specified properties in a type-safe manner. Like
 * {@link Omit}, but with real effect on the object.
 * @param object The object to modify.
 * @param properties The properties to delete.
 */
export function deleteProperty<T, K extends keyof T>(object: T, ...properties: K[]) {
  for (const property of properties) {
    delete object[property];
  }
  return object as Omit<T, K>;
}

/**
 * Adds a `key` property to each object in the given object.
 * @param object The object to modify.
 */
export function addKeys<T extends object>(object: T) {
  for (const key in object) Object.assign(object[key], { key });
  return object as { [K in keyof T]: T[K] & { key: K } };
}

/**
 * Removes the `key` property from each object in the given object.
 * @param object The object to modify.
 */
export function omitKeys<T extends object>(object: { [K in keyof T]: T[K] & { key: K } }) {
  for (const key in object) delete object[key].key;
  return object as T;
}

/**
 * Maps the values of the given object.
 * @param object The object to map.
 * @param callback The callback to map the values.
 */
export function mapValues<T extends object, U>(
  object: T,
  callback: (t: T[keyof T], key: keyof T) => U
) {
  return Object.fromEntries(
    Object.entries(object).map(([key, value]) => [key, callback(value, key as keyof T)])
  ) as { [P in keyof T]: U };
}
