import { describe, expect, it, vi } from 'vitest';
import { closeAfterFlush } from './close-window';

describe('closeAfterFlush()', () => {
  it('flushes and then closes once the renderer is ready', async () => {
    // Arrange
    const calls: string[] = [];
    const flush = vi.fn(async () => {
      calls.push('flush');
    });
    const close = vi.fn(() => calls.push('close'));

    // Act
    await closeAfterFlush(Promise.resolve(), flush, close);

    // Assert
    expect(calls).toEqual(['flush', 'close']);
  });

  it('still flushes and closes if waiting for the renderer fails', async () => {
    // Arrange
    const flush = vi.fn(() => Promise.resolve());
    const close = vi.fn();

    // Act
    await closeAfterFlush(Promise.reject(new Error('timeout')), flush, close);

    // Assert
    expect(flush).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });

  it('still closes if flushing fails', async () => {
    // Arrange
    const close = vi.fn();

    // Act
    await closeAfterFlush(Promise.resolve(), () => Promise.reject(new Error('disk full')), close);

    // Assert
    expect(close).toHaveBeenCalledOnce();
  });
});
