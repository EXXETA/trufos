import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Writable } from 'node:stream';
import Transport from 'winston-transport';
import { LogEntry } from 'shim/logger';
import { transports } from 'winston';

import './logger';

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
      expect((memoryTransport.logs[0] as LogEntry).message).toBe(message);
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

  it('should log objects to console', async () => {
    // Arrange
    const now = new Date();
    const message = 'message';
    const number = 1.23;
    const object = { test: 'test' };
    const string = 'test';
    const array = [1, 2, 3];
    const expected = `${now.toISOString()} [MAIN] [DEBUG]: ${message} ${number} { test: 'test' } ${string} [ 1, 2, 3 ]\n`;

    const data: unknown[] = [];
    const stream = new Writable({ write: (chunk) => data.push(chunk) });
    const transport = new transports.Stream({ stream });

    vi.useFakeTimers({ now });
    logger.add(transport);

    try {
      // Act
      logger.debug(message, number, object, string, array);

      // Assert
      expect(data.length).toBe(1);
      expect(data[0]).toBeInstanceOf(Buffer);
      const actual = data[0].toString();
      expect(actual).toEqual(expected);
    } finally {
      vi.useRealTimers();
      logger.remove(transport);
    }
  });
});
