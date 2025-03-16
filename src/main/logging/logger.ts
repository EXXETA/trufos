import winston, { format, Logform, transports } from 'winston';
import { app, ipcMain } from 'electron';
import { LogEntry } from 'shim/logger';

console.info('Saving logs at', app.getPath('logs'));

declare global {
  // eslint-disable-next-line no-var
  var logger: winston.Logger;
}

function print({
  timestamp,
  level,
  process,
  message,
}: Logform.TransformableInfo & LogEntry & { timestamp: string }) {
  return `${timestamp} [${process.toUpperCase()}] [${level.toUpperCase()}]: ${message}`;
}

global.logger = winston.createLogger({
  level: 'info',
  format: format.combine(
    format.splat(),
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.printf(print)
  ),
  defaultMeta: { process: 'main' },
  transports: [
    new winston.transports.File({ dirname: app.getPath('logs'), filename: 'combined.log' }),
  ],
});

if (!app.isPackaged) {
  logger.add(new transports.Console());
}

ipcMain.on('log', (event, data: LogEntry) => {
  logger.write(data);
});
