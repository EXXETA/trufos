import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import {
  getDurationTextInSec,
  getHttpStatusColorClass,
  getHttpStatusText,
} from '@/components/mainWindow/responseStatus/ResponseStatusFormatter';
import { httpMethodColor } from '@/services/StyleHelper';
import { cn } from '@/lib/utils';
import { HttpHeaders } from 'shim/headers';
import { HistoryEntry, ScriptLog, StoredBody, summarizeHistoryEntry } from 'shim/history';
import { HistoryBodyViewer } from './HistoryBodyViewer';

export interface HistoryEntryDetailProps {
  entry: HistoryEntry;
}

/** Shows one request history entry: the sent request, the received response and script output. */
export const HistoryEntryDetail = ({ entry }: HistoryEntryDetailProps) => {
  const { request, outcome, scriptLogs } = entry;
  const summary = summarizeHistoryEntry(entry);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-4">
      <div className="flex flex-col gap-1">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className={cn('text-sm font-bold', httpMethodColor(entry.method))}>
            {entry.method}
          </span>
          <span className="truncate text-sm select-text" title={entry.url}>
            {entry.url}
          </span>
        </div>
        <div className="text-text-secondary flex gap-3 text-xs">
          <span>{entry.requestTitle}</span>
          <span>{new Date(entry.timestamp).toLocaleString()}</span>
          {summary.status != null && (
            <span className={getHttpStatusColorClass(summary.status)}>
              {getHttpStatusText(summary.status)}
            </span>
          )}
          {summary.duration != null && <span>{getDurationTextInSec(summary.duration)}</span>}
        </div>
        {outcome.type === 'error' && <span className="error text-sm">{outcome.message}</span>}
        {outcome.type === 'aborted' && (
          <span className="text-text-secondary text-sm">The request was aborted.</span>
        )}
      </div>

      <Tabs defaultValue="request" className="flex min-h-0 flex-1 flex-col bg-transparent">
        <TabsList className="shrink-0 bg-transparent">
          <TabsTrigger value="request">Request</TabsTrigger>
          <TabsTrigger value="response">Response</TabsTrigger>
          <TabsTrigger value="scripts">Scripts ({scriptLogs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="request" className="flex min-h-0 flex-col gap-3 p-4">
          {request == null ? (
            <Placeholder>The request was not sent.</Placeholder>
          ) : (
            <Message headers={request.headers} body={request.body} />
          )}
        </TabsContent>

        <TabsContent value="response" className="flex min-h-0 flex-col gap-3 p-4">
          {outcome.type === 'response' ? (
            <Message headers={outcome.response.headers} body={outcome.response.body} />
          ) : (
            <Placeholder>
              {outcome.type === 'error' ? outcome.message : 'The request was aborted.'}
            </Placeholder>
          )}
        </TabsContent>

        <TabsContent value="scripts" className="p-4">
          {scriptLogs.length === 0 ? (
            <Placeholder>The scripts of this request did not log anything.</Placeholder>
          ) : (
            <ScriptLogs logs={scriptLogs} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

const Placeholder = ({ children }: { children: React.ReactNode }) => (
  <p className="text-text-secondary text-sm">{children}</p>
);

const Message = ({ headers, body }: { headers: HttpHeaders; body?: StoredBody }) => (
  <>
    <div className="max-h-48 shrink-0 overflow-y-auto">
      <HeadersTable headers={headers} />
    </div>
    {body == null ? (
      <Placeholder>No body.</Placeholder>
    ) : (
      <HistoryBodyViewer key={body.id} body={body} headers={headers} />
    )}
  </>
);

const HeadersTable = ({ headers }: { headers: HttpHeaders }) => {
  const rows = Object.entries(headers).flatMap(([key, value]) =>
    [value ?? []].flat().map((single, index) => ({ key, value: single, id: `${key}-${index}` }))
  );
  if (rows.length === 0) return <Placeholder>No headers.</Placeholder>;

  return (
    <Table aria-label="Headers">
      <TableBody>
        {rows.map(({ key, value, id }) => (
          <TableRow key={id}>
            <TableCell className="w-1/3 py-1 align-top font-medium break-all">{key}</TableCell>
            <TableCell className="py-1 break-all select-text">{value}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

const LOG_LEVEL_CLASS: Record<ScriptLog['level'], string> = {
  debug: 'text-text-secondary',
  info: '',
  warn: 'text-state-warning',
  error: 'error',
};

const ScriptLogs = ({ logs }: { logs: ScriptLog[] }) => (
  <ol className="flex flex-col gap-1 font-mono text-xs">
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
