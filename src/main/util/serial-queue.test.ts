import { describe, expect, it, vi } from 'vitest';
import { SerialQueue } from './serial-queue';

describe('SerialQueue', () => {
  it('runs tasks in order, one at a time', async () => {
    // Arrange
    const queue = new SerialQueue();
    const order: string[] = [];
    let releaseFirst!: () => void;
    const released = new Promise<void>((resolve) => (releaseFirst = resolve));

    // Act
    const first = queue.run(async () => {
      order.push('first started');
      await released;
      order.push('first done');
      return 1;
    });
    const second = queue.run(() => {
      order.push('second');
      return 2;
    });
    await new Promise((resolve) => setImmediate(resolve));
    expect(order).toEqual(['first started']);
    releaseFirst();

    // Assert
    await expect(Promise.all([first, second])).resolves.toEqual([1, 2]);
    expect(order).toEqual(['first started', 'first done', 'second']);
  });

  it('runs the next task even if the previous one failed', async () => {
    // Arrange
    const queue = new SerialQueue();
    const failure = new Error('failed');
    const next = vi.fn(() => 'next');

    // Act
    const failing = queue.run(() => Promise.reject(failure));
    const following = queue.run(next);

    // Assert
    await expect(failing).rejects.toBe(failure);
    await expect(following).resolves.toBe('next');
  });

  it('rejects with the error of a task that throws synchronously', async () => {
    // Arrange
    const queue = new SerialQueue();
    const failure = new Error('thrown');

    // Act & Assert
    await expect(
      queue.run(() => {
        throw failure;
      })
    ).rejects.toBe(failure);
    await expect(queue.run(() => 'ok')).resolves.toBe('ok');
  });
});
