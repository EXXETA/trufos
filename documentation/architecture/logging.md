---
title: Logging
nav_order: 10
parent: Architecture
description: How the main and renderer processes log, where the log files are and how secrets are kept out of them.
---

# Logging

The main process logs with [Winston](https://github.com/winstonjs/winston). The renderer logs with `console`, and every entry is forwarded to main, so both processes end up in the same log file.

## Main process

`src/main/logging/logger.ts` is the first import of `main.ts`. It creates a global `logger`, so main-process code logs without importing anything:

```ts
logger.info('Loading collection from', dirPath);
logger.warn('Not storing the state of collection', dirPath);
logger.error('Failed to write the pending changes before closing:', error);
logger.debug('Registered event channels on backend');
```

- **Level**: the file gets `warn` and above.
- **File**: `trufos.log` in the log directory (`app.getPath('logs')`), rotated at 10 MiB, keeping up to 10 files.
- **Console**: in an unpackaged build (`yarn start`), a console transport logs everything from `debug` up to the terminal.
- **Format**: `2026-11-13T10:20:30.123Z [MAIN] [INFO]: message`. Arguments after the message are formatted like `console.log` does (`util.format`), and an `Error` is printed with its stack.

### Secrets

Requests, responses and variables can contain secrets, so they are never logged as a whole. The request history records them instead, and it is kept in memory only. To log something that may contain a secret while debugging, use `logger.secret`:

```ts
logger.secret.debug('Resolved authorization header', header);
```

These entries go to the console in development, but never to the log file.

## Renderer process

`src/renderer/logging/console.ts` replaces `window.console`. Each of `log`, `info`, `debug`, `warn` and `error` still writes to the DevTools console, and also sends a `LogEntry` (`src/shim/logger.ts`) to main through the `log` event. `console.log` is logged as `info`.

Main writes these entries to the same Winston logger, marked as `[RENDERER]`. So a renderer error appears in DevTools, in the terminal during development and in `trufos.log`.

## Where the logs are

| Platform | Log directory |
| --- | --- |
| Windows | `%APPDATA%\Trufos\logs` |
| macOS | `~/Library/Logs/Trufos` |
| Linux | `~/.config/Trufos/logs` |

Users open it with **Help › Open Logs Folder** (`openLogDirectory()`), see [First Steps]({% link documentation/user-guide/first-steps.md %}#where-to-find-the-logs). During development the main-process log is also in the terminal that runs `yarn start`; open the renderer's DevTools from the **View** menu.
