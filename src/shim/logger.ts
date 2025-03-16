export type LogLevel = 'info' | 'debug' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  message: string;
  process: 'renderer' | 'main';
  splat: unknown[];
}
