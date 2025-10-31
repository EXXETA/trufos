import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from '@/lib/event-emitter';

interface TestEvents {
  test(value?: number): void;
  other(text: string): void;
}

class TestEmitter extends EventEmitter<TestEvents> {
  public trigger<K extends keyof TestEvents>(event: K, ...args: Parameters<TestEvents[K]>) {
    // expose protected emit for tests
    (this as any).emit(event, ...args);
  }
}

describe('EventEmitter', () => {
  it('should call once listener only one time', () => {
    const emitter = new TestEmitter();
    const fn = vi.fn();
    emitter.once('test', fn);

    emitter.trigger('test', 1);
    emitter.trigger('test', 2);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(1);
  });

  it('should allow removing listener inside once without affecting others', () => {
    const emitter = new TestEmitter();
    const order: number[] = [];
    emitter.once('test', () => order.push(1));
    emitter.on('test', () => order.push(2));

    emitter.trigger('test');
    emitter.trigger('test');

    expect(order).toEqual([1, 2, 2]);
  });

  it('should not fail when removing a non-existing listener from a valid event', () => {
    const emitter = new TestEmitter();
    const fn = vi.fn();
    // removing a listener that was never registered should be a no-op
    expect(() => emitter.off('test', fn)).not.toThrow();
  });

  it('should not affect other listeners when one throws', () => {
    const emitter = new TestEmitter();
    const fn1 = vi.fn(() => {
      throw new Error('Test error');
    });
    const fn2 = vi.fn();

    emitter.on('test', fn1);
    emitter.on('test', fn2);

    // @ts-expect-error invalid argument type
    emitter.on('other', (n: number) => {});

    expect(() => emitter.trigger('test')).not.toThrow();
    expect(fn2).toHaveBeenCalled();
  });
});
