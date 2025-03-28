type Primitive = string | number | boolean | null | undefined | symbol | bigint;
type DeepValue = Primitive | { [key: string]: DeepValue } | DeepValue[];
type ShallowValue = Primitive | { [key: string]: unknown } | unknown[];

export const shallowEqual = (objA: ShallowValue, objB: ShallowValue): boolean => {
  if (objA === objB) {
    return true;
  }

  if (
    objA === null ||
    objB === null ||
    typeof objA !== 'object' ||
    typeof objB !== 'object' ||
    Array.isArray(objA) !== Array.isArray(objB)
  ) {
    return false;
  }

  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);

  if (keysA.length !== keysB.length) {
    return false;
  }

  for (const key of keysA) {
    if (!(key in objB)) {
      return false;
    }

    const valueA = (objA as Record<string, unknown>)[key];
    const valueB = (objB as Record<string, unknown>)[key];

    if (valueA !== valueB) {
      return false;
    }
  }

  return true;
};

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
