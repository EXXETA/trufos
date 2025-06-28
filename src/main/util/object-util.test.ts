import { describe, it, expect } from 'vitest';
import { assign, split } from './object-util';

describe('assign()', () => {
  it('should merge shallow properties', () => {
    const target = { a: 1, b: 2 };
    const source = { b: 3, c: 4 };
    const result = assign(structuredClone(target), source);
    expect(result).toEqual({ ...target, ...source });
  });

  it('should merge deeply nested objects', () => {
    const target = { a: { x: 1, y: 2 }, b: 2 };
    const source = { a: { y: 3, z: 4 }, c: 5 };
    const result = assign(structuredClone(target), source);
    expect(result).toEqual({ a: { x: 1, y: 3, z: 4 }, b: 2, c: 5 });
  });

  it('should overwrite non-object properties', () => {
    const target = { a: 1, b: { x: 2 } };
    const source = { a: { y: 3 }, b: 4 };
    const result = assign(structuredClone(target), source);
    expect(result).toEqual({ a: { y: 3 }, b: 4 });
  });

  it('should return target if either argument is not an object', () => {
    const obj = { a: 1 };
    expect(assign(null, structuredClone(obj))).toBe(null);
    expect(assign(structuredClone(obj), null)).toEqual(obj);
  });

  it('should handle empty source', () => {
    const target = { a: 1 };
    const result = assign(structuredClone(target), {});
    expect(result).toEqual(target);
  });

  it('should handle empty target', () => {
    const source = { a: 1 };
    const result = assign({}, source);
    expect(result).toEqual(source);
  });
});

describe('split()', () => {
  it('should split specified properties and remove them from the original object', () => {
    const obj = { a: 1, b: 2, c: 3 };
    const result = split(obj, 'a', 'c');
    expect(result).toEqual({ a: 1, c: 3 });
    expect(obj).toEqual({ b: 2 });
  });

  it('should return an empty object if no properties are specified', () => {
    const obj = { a: 1, b: 2 };
    const result = split(obj);
    expect(result).toEqual({});
    expect(obj).toEqual({ a: 1, b: 2 });
  });

  it('should not fail if a property does not exist', () => {
    const obj = { a: 1 } as { a: number; b?: number };
    const result = split(obj, 'b');
    expect(result).toEqual({});
    expect(obj).toEqual({ a: 1 });
  });
});
