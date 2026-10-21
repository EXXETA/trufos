type Primitive = string | number | boolean | null | undefined | symbol | bigint;
type PlainObject = { [key: string]: DeepValue };
type DeepValue = Primitive | PlainObject | DeepValue[];

export const deepEqual = (original: DeepValue, compare: DeepValue): boolean => {
  if (original === compare) return true;

  const isPrimitive = (obj: unknown): obj is Primitive =>
    obj === null || (typeof obj !== 'object' && typeof obj !== 'function');

  if (isPrimitive(original) || isPrimitive(compare)) return original === compare;

  if (!original || !compare || Array.isArray(original) !== Array.isArray(compare)) return false;

  if (Array.isArray(original) && Array.isArray(compare)) {
    if (original.length !== compare.length) return false;
    return original.every((item, index) => deepEqual(item, compare[index]));
  }

  const keysOriginal = Object.keys(original as Record<string, unknown>);
  const keysCompare = Object.keys(compare as Record<string, unknown>);

  if (keysOriginal.length !== keysCompare.length) return false;

  for (const key of keysOriginal) {
    if (!(key in (compare as Record<string, unknown>))) return false;

    const originalValue = (original as Record<string, DeepValue>)[key];
    const compareValue = (compare as Record<string, DeepValue>)[key];

    if (!deepEqual(originalValue, compareValue)) return false;
  }

  return true;
};
