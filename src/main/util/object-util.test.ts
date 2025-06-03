import { describe, it, expect } from 'vitest';
import { assign } from './object-util';

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
