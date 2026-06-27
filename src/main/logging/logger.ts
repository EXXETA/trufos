import winston, { format, transports } from 'winston';
import { Format, TransformableInfo } from 'logform';
import { app, ipcMain } from 'electron';
import { LogEntry } from 'shim/logger';
import { format as formatString } from 'node:util';
import { omit } from 'main/util/object-util';

const SPLAT = Symbol.for('splat');
const LOG_SECRET = Symbol('logSecret');

console.info('Saving logs at', app.getPath('logs'));

type TransformableInfoExtended = TransformableInfo & LogEntry;

declare global {
   
  var logger: winston.Logger & {
    secret: {
      info: (message: string, ...meta: unknown[]) => void;
      debug: (message: string, ...meta: unknown[]) => void;
      warn: (message: string, ...meta: unknown[]) => void;
      error: (message: string, ...meta: unknown[]) => void;
    };
  };
}

class SplatFormat implements Format {
  // @ts-expect-error logform's Format.transform signature uses TransformableInfo but we use an extended type
  transform(info: TransformableInfoExtended) {
    if (info instanceof Error) {
      info.message = info.stack ?? info.message;
      return info;
    }

    let args = info[SPLAT] as unknown[];
    if (!Array.isArray(args)) args = [];

    // check if this is a secret log
    if (args.length > 0 && args[0] === LOG_SECRET) {
      info.isSecret = true;
      args = args.slice(1);
    }

    // ensure the message is a string
    if (typeof info.message !== 'string') {
      args.unshift(info.message);
      info.message = '';
    }

    // handle broken error object formatting
    if (args.length > 0 && args[0] instanceof Error) {
      info.message = info.message.slice(0, -args[0].message.length - 1);
    }

    // format any other arguments
    info.message = formatString(info.message, ...args);
    return info;
  }
}

class SecretFilter implements Format {
  // @ts-expect-error logform's Format.transform signature uses TransformableInfo but we use an extended type
  transform(info: TransformableInfoExtended) {
    return info.isSecret === true ? false : info;
  }
}

function print({
  timestamp,
  level,
  process,
  message,
}: TransformableInfoExtended & { timestamp: string }) {
  return `${timestamp} [${process.toUpperCase()}] [${level.toUpperCase()}]: ${message}`;
}

// @ts-expect-error print uses extended TransformableInfo type
const BASE_FORMAT = format.combine(new SplatFormat(), format.timestamp(), format.printf(print));

global.logger = winston.createLogger({
  level: 'warn',
  format: BASE_FORMAT,
  defaultMeta: { process: 'main' },
  transports: [
    new winston.transports.File({
      dirname: app.getPath('logs'),
      filename: 'trufos.log',
      maxFiles: 10,
      maxsize: 1024 * 1024 * 10, // 10MiB
      tailable: true,
      // @ts-expect-error SecretFilter.transform returns false for secrets, which is valid logform behavior
      format: format.combine(new SecretFilter(), BASE_FORMAT),
    }),
  ],
}) as any;

// Add secret logging methods that automatically mark logs as secret
logger.secret = {
  info: (message: string, ...meta: unknown[]) => logger.info(message, LOG_SECRET, ...meta),
  debug: (message: string, ...meta: unknown[]) => logger.debug(message, LOG_SECRET, ...meta),
  warn: (message: string, ...meta: unknown[]) => logger.warn(message, LOG_SECRET, ...meta),
  error: (message: string, ...meta: unknown[]) => logger.error(message, LOG_SECRET, ...meta),
};

if (!app.isPackaged) {
  logger.add(new transports.Console({ level: 'debug' }));
}

ipcMain.on('log', (event, data: TransformableInfo & LogEntry) => {
  data[SPLAT] = data.splat;
  omit(data, 'splat');
  logger.write(data);
});
