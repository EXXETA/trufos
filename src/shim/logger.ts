import { z } from 'zod';

export const LogLevel = z.enum(['info', 'debug', 'warn', 'error']);
export type LogLevel = z.infer<typeof LogLevel>;

export interface LogEntry {
  level: LogLevel;
  message: string;
  process: 'renderer' | 'main';
  isSecret?: boolean;
  splat: unknown[];
}
