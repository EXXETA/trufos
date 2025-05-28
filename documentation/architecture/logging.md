---
title: Logging
nav_order: 7
parent: Architecture Overview
---

# Logging

Trufos utilizes a structured logging approach to help developers debug issues and understand application flow. Logging is implemented differently in the main and renderer processes but aims for a unified output where possible.

## Main Process Logging

*   **Library**: [Winston](https://github.com/winstonjs/winston) is used for logging in the main process.
*   **Configuration**: `src/main/logging/logger.ts`
    *   A global `logger` instance is created and attached to the `global` object.
    *   **Log Level**: Defaults to `warn`. In non-packaged (development) mode, an additional console transport is added with level `info`. This can be adjusted (e.g., `logger.level = 'debug'`).
    *   **Transports**:
        *   `File Transport`: Logs are written to `trufos.log` in the application's log directory (accessible via `app.getPath('logs')`). Log files are rotated (max 10 files, 10MB each).
        *   `Console Transport`: Added only if `!app.isPackaged` (i.e., in development/testing).
    *   **Format**:
        *   `SplatFormat`: A custom Winston format (`SplatFormat` class) is used to properly handle string interpolation and error object formatting (e.g., printing error stacks). It processes the `Symbol.for('splat')` array provided by Winston when multiple arguments are passed to a log function.
        *   `timestamp`: Adds a timestamp to each log entry.
        *   `printf`: A custom print function formats the log message as:
            `YYYY-MM-DDTHH:mm:ss.SSSZ [PROCESS_NAME] [LEVEL]: message`
            (e.g., `2023-10-27T10:20:30.123Z [MAIN] [INFO]: Application started`)
    *   **Default Metadata**: `{ process: 'main' }` is added to all logs originating from the main process logger.

*   **Usage**:
    ```typescript
    // global.logger is available throughout the main process
    logger.info('Informational message');
    logger.warn('A warning occurred', { details: 'some details' });
    logger.error('An error happened:', new Error('Something went wrong'));
    logger.debug('Debugging information', variableValue);
    ```

## Renderer Process Logging

*   **Mechanism**: `src/renderer/logging/console.ts`
    *   The global `window.console` object in the renderer process is augmented.
    *   Methods like `console.log`, `console.info`, `console.warn`, `console.error`, `console.debug` are overridden.
    *   The overridden methods perform two actions:
        1.  Call the original `console` method (e.g., `_console.info(...)`) to ensure messages still appear in the renderer's DevTools console.
        2.  Construct a `LogEntry` object (defined in `src/shim/logger.ts`) and send it to the main process via IPC using the channel `'log'`.
            ```typescript
            // Simplified from src/renderer/logging/console.ts
            function log(level: LogLevel, ...data: unknown[]) {
              _console[level](...data); // Original console output

              const [message, ...splat] = data;
              const entry: LogEntry = {
                process: 'renderer',
                level,
                message: `${message ?? ''}`,
                splat,
              };
              window.electron.ipcRenderer.send('log', entry); // Send to main process
            }
            ```

## IPC Log Forwarding

*   **Channel**: `'log'`
*   **Main Process Handler**: In `src/main/logging/logger.ts`:
    ```typescript
    ipcMain.on('log', (event, data: TransformableInfo & LogEntry) => {
      data[SPLAT] = data.splat; // Restore splat for Winston formatting
      delete data.splat;
      logger.write(data); // Write the LogEntry from renderer to Winston
    });
    ```
    This handler receives `LogEntry` objects from any renderer process and writes them to the main process's Winston logger. This ensures that renderer logs are also captured in the central log file and, during development, appear in the main process console output if its level is appropriate.

## Log Structure (`LogEntry`)

Defined in `src/shim/logger.ts`:
```typescript
export type LogLevel = 'info' | 'debug' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  message: string;
  process: 'renderer' | 'main'; // Identifies the source process
  splat: unknown[]; // Additional arguments passed to the log function
}
```
This standardized structure helps in consistent formatting and filtering of logs.

## Accessing Logs

*   **Development**:
    *   Main process logs: Appear in the terminal where `yarn start` was run.
    *   Renderer process logs: Appear in the renderer's DevTools console AND are forwarded to the main process terminal/log file.
*   **Production**:
    *   All logs (main and renderer) are written to `trufos.log` located in:
        *   macOS: `~/Library/Logs/Trufos/trufos.log`
        *   Windows: `%USERPROFILE%\AppData\Roaming\Trufos\logs\trufos.log`
        *   Linux: `~/.config/Trufos/logs/trufos.log`
        (The exact path can be confirmed by `app.getPath('logs')`).

This logging setup provides comprehensive diagnostic information for developers across both main and renderer processes. 