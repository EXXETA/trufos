import { cn } from '@/lib/utils';
import { ScriptLog } from 'shim/history';

const LOG_LEVEL_CLASS: Record<ScriptLog['level'], string> = {
  debug: 'text-text-secondary',
  info: '',
  warn: 'text-state-warning',
  error: 'error',
};

export interface ScriptLogsProps {
  logs: ScriptLog[];
}

/** Shows the console output and errors of the scripts of a request, like a console would. */
export const ScriptLogs = ({ logs }: ScriptLogsProps) => (
  <ol aria-label="Console" className="flex flex-col gap-1 font-mono text-xs">
    {logs.map((log, index) => (
      <li key={index} className={cn('break-all whitespace-pre-wrap', LOG_LEVEL_CLASS[log.level])}>
        <span className="text-text-secondary">[{log.script ?? 'script'}]</span>{' '}
        {log.args.map(formatArg).join(' ')}
      </li>
    ))}
  </ol>
);

/** Formats a logged value for display like a console would. */
function formatArg(arg: unknown): string {
  if (typeof arg === 'string') return arg;
  if (arg instanceof Error) return arg.stack ?? `${arg.name}: ${arg.message}`;
  try {
    return JSON.stringify(arg, null, 2) ?? String(arg);
  } catch {
    return String(arg);
  }
}
