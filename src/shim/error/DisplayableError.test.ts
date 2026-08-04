import { describe, it, expect } from 'vitest';
import { DisplayableError } from './DisplayableError';

describe('DisplayableError', () => {
  it('defaults the title and uses the description as the message', () => {
    const error = new DisplayableError('some description');
    expect(error.description).toBe('some description');
    expect(error.title).toBe(DisplayableError.DEFAULT_TITLE);
    expect(error.message).toBe('some description');
  });

  it('serializes to a plain object without the cause', () => {
    const error = new DisplayableError('desc', 'Title', new Error('root cause'));
    const serialized = error.serialize();
    expect(serialized).toEqual({ __displayableError: true, title: 'Title', description: 'desc' });
    expect(serialized).not.toHaveProperty('cause');
  });

  it('round-trips through serialize/deserialize', () => {
    const original = new DisplayableError('desc', 'Title', new Error('cause'));
    const restored = DisplayableError.deserialize(original.serialize());
    expect(restored).toBeInstanceOf(DisplayableError);
    expect(restored.title).toBe('Title');
    expect(restored.description).toBe('desc');
  });

  it('detects serialized errors and rejects other values', () => {
    expect(DisplayableError.isSerialized(new DisplayableError('desc').serialize())).toBe(true);
    expect(DisplayableError.isSerialized(new Error('desc'))).toBe(false);
    expect(DisplayableError.isSerialized({ title: 'x' })).toBe(false);
    expect(DisplayableError.isSerialized(null)).toBe(false);
    expect(DisplayableError.isSerialized('string')).toBe(false);
  });
});
