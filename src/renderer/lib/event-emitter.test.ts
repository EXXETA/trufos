import { describe, it, expect, vi } from 'vitest';
import { EventEmitter, once } from '@/lib/event-emitter';

interface TestEvents {
  test(value?: number): void;
  other(text: string): void;
  error(err: Error): void;
}

class TestEmitter extends EventEmitter<TestEvents> {
  public trigger<K extends keyof TestEvents>(event: K, ...args: Parameters<TestEvents[K]>) {
    this.emit(event, ...args);
  }
  public triggerError(err: Error) {
    this.emit('error', err);
  }
}

describe('EventEmitter', () => {
  it('should call once listener only one time', () => {
    // Arrange
    const emitter = new TestEmitter();
    const fn = vi.fn();
    emitter.once('test', fn);

    // Act
    emitter.trigger('test', 1);
    emitter.trigger('test', 2);

    // Assert
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(1);
  });

  it('should allow removing listener inside once without affecting others', () => {
    // Arrange
    const emitter = new TestEmitter();
    const order: number[] = [];
    emitter.once('test', () => order.push(1));
    emitter.on('test', () => order.push(2));

    // Act
    emitter.trigger('test');
    emitter.trigger('test');

    // Assert
    expect(order).toEqual([1, 2, 2]);
  });

  it('should not fail when removing a non-existing listener from a valid event', () => {
    // Arrange
    const emitter = new TestEmitter();
    const fn = vi.fn();

    // Act & Assert
    expect(() => emitter.off('test', fn)).not.toThrow();
  });

  it('should not affect other listeners when one throws', () => {
    // Arrange
    const emitter = new TestEmitter();
    const fn1 = vi.fn(() => {
      throw new Error('Test error');
    });
    const fn2 = vi.fn();

    // Act
    emitter.on('test', fn1);
    emitter.on('test', fn2);

    // @ts-expect-error invalid argument type
    emitter.on('other', (n: number) => {});

    // Assert
    expect(() => emitter.trigger('test')).not.toThrow();
    expect(fn2).toHaveBeenCalled();
  });

  it('once helper resolves with args array', async () => {
    // Arrange
    const emitter = new TestEmitter();
    const promise = once(emitter, 'test');

    // Act
    emitter.trigger('test', 7);

    // Assert
    await expect(promise).resolves.toEqual([7]);
  });

  it('once helper rejects on error before event', async () => {
    // Arrange
    const emitter = new TestEmitter();
    const promise = once(emitter, 'test');
    const error = new Error('boom');

    // Act
    emitter.triggerError(error);

    // Assert
    await expect(promise).rejects.toThrow('boom');
  });
});
