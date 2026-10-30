import { RendererEventService } from '@/services/event/renderer-event-service';
import { RendererEvent } from 'shim/event-service';
import { LogEntry, LogLevel } from 'shim/logger';

const _console = window.console;

function log(level: LogLevel, ...data: unknown[]) {
  switch (level) {
    case 'info':
    case 'debug':
    case 'warn':
    case 'error':
      _console[level](...data);
      break;
  }

  const [message, ...splat] = data;
  const entry: LogEntry = {
    process: 'renderer',
    level,
    message: `${message ?? ''}`,
    splat,
  };
  RendererEventService.instance.emit(RendererEvent.Log, entry);
}

window.console = {
  ..._console,
  log: (...data: unknown[]) => log('info', ...data),
  info: (...data: unknown[]) => log('info', ...data),
  debug: (...data: unknown[]) => log('debug', ...data),
  warn: (...data: unknown[]) => log('warn', ...data),
  error: (...data: unknown[]) => log('error', ...data),
};
