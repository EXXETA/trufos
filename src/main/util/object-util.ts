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

/**
 * Splits the given object into two parts: one containing the specified properties and the other
 * containing the rest. The specified properties are removed from the original object.
 * @param object The source object.
 * @param properties The properties to split out.
 * @returns An object containing the specified properties.
 */
export function split<T extends object, K extends keyof T>(object: T, ...properties: K[]) {
  const result = {} as Pick<T, K>;
  for (const property of properties) {
    const value = object[property];
    if (value !== undefined) {
      result[property] = value;
      delete object[property];
    }
  }
  return result;
}

function isObject(value: unknown): value is object {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Merges the properties of the source object into the target object in a type-safe manner.
 * If a property exists in both objects and is an object itself, it will recursively merge them.
 * @param target The target object to modify.
 * @param source The source object whose properties will be merged into the target.
 * @returns The modified target object with properties from the source object.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function assign<T extends Record<any, any>, U extends Record<any, any>>(
  target: T,
  source: U
): T & U {
  if (!isObject(target) || !isObject(source)) {
    return target;
  }

  for (const key in source) {
    target[key] =
      key in target && isObject(source[key]) && isObject(target[key])
        ? assign(target[key], source[key])
        : source[key];
  }
  return target;
}
