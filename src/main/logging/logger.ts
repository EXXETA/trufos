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
    if (info instanceof Error) {
      info.message = info.stack ?? info.message;
      return info;
    }

    let args = info[SPLAT] as unknown[];
    if (!Array.isArray(args)) args = [];
    if (args.length === 0 && info.message instanceof Error) {
      info.message = info.message.stack ?? info.message.message;
    } else if (args.length !== 0 && args[args.length - 1] instanceof Error) {
      const error = args.pop() as Error;
      if (typeof info.message === 'string' && info.message.length !== 0) {
        info.message = info.message.slice(0, -error.message.length - 1);
      }
      args.push(error.stack);
    }

    // format rest of the arguments
    info.message = formatString(info.message, ...args);
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
  format: format.combine(new SplatFormat(), format.timestamp(), format.printf(print)),
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
