import winston, { format, transports } from 'winston';
import { Format, TransformableInfo } from 'logform';
import { app, ipcMain } from 'electron';
import { LogEntry } from 'shim/logger';
import { format as formatString } from 'node:util';

const SPLAT = Symbol.for('splat');

console.info('Saving logs at', app.getPath('logs'));

declare global {
  // eslint-disable-next-line no-var
  var logger: winston.Logger;
}

class SplatFormat implements Format {
  transform(info: TransformableInfo) {
    const args = info[SPLAT];
    if (Array.isArray(args)) info.message = formatString(info.message, ...args);
    return info;
  }
}

function print({
  timestamp,
  level,
  process,
  message,
}: TransformableInfo & LogEntry & { timestamp: string }) {
  return `${timestamp} [${process.toUpperCase()}] [${level.toUpperCase()}]: ${message}`;
}

global.logger = winston.createLogger({
  level: 'warn',
  format: format.combine(format.timestamp(), new SplatFormat(), format.printf(print)),
  defaultMeta: { process: 'main' },
  transports: [
    new winston.transports.File({
      dirname: app.getPath('logs'),
      filename: 'trufos.log',
      maxFiles: 10,
      maxsize: 1024 * 1024 * 10, // 10MiB
      tailable: true,
    }),
  ],
});

if (!app.isPackaged) {
  logger.add(new transports.Console({ level: 'info' }));
}

ipcMain.on('log', (event, data: TransformableInfo & LogEntry) => {
  data[SPLAT] = data.splat;
  delete data.splat;
  logger.write(data);
});
