/**
 * @param value the value to check
 * @returns true if the value is a plain object, i.e. not null and not an array
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
