import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import './logger';
import Transport from 'winston-transport';

class MemoryTransport extends Transport {
  public logs: unknown[] = [];

  log(info: unknown, callback: () => void) {
    setImmediate(() => this.emit('logged', info));
    this.logs.push(info);
    callback();
  }
}

describe('Logger', () => {
  let memoryTransport: MemoryTransport;

  beforeEach(() => {
    logger.level = 'debug';
    logger?.add((memoryTransport = new MemoryTransport()));
  });

  afterEach(() => {
    logger?.remove(memoryTransport);
    logger.level = 'info';
  });

  it('should provide a global logger', () => {
    // Assert
    expect(logger).toBeDefined();
  });

  it.each(['info', 'warn', 'debug', 'error'] as const)(
    'should log on %s to console in development or tests',
    async (level) => {
      // Arrange
      const message = 'test';

      // Act
      logger[level](message);

      // Assert
      expect(memoryTransport.logs).toHaveLength(1);
      expect(memoryTransport.logs[0].message).toBe(message);
    }
  );

  it('should respect the log level', () => {
    // Arrange
    logger.level = 'debug';

    // Act
    logger.debug('test');

    // Assert
    expect(memoryTransport.logs).toHaveLength(1);

    // Arrange
    logger.level = 'info';

    // Act
    logger.debug('test');

    // Assert
    expect(memoryTransport.logs).toHaveLength(1);
  });
});
