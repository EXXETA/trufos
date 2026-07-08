import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { editor } from 'monaco-editor';
import { ChevronDown, ChevronRight, Loader2, Play, Square, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useResponseData } from '@/components/mainWindow/bodyTabs/OutputTabs/PrettyRenderer';
import { FolderIcon } from '@/components/icons';
import { HttpService } from '@/services/http/http-service';
import { httpMethodColor } from '@/services/StyleHelper';
import { getIndentation } from '@/components/sidebar/SidebarRequestList/Nav/indentation';
import { saveModelContent } from '@/lib/monaco/models';
import { cn } from '@/lib/utils';
import { useCollectionStore } from '@/state/collectionStore';
import {
  selectEnvironments,
  selectSelectedEnvironment,
  useEnvironmentActions,
  useEnvironmentStore,
} from '@/state/environmentStore';
import { useResponseActions } from '@/state/responseStore';
import { showError } from '@/error/errorHandler';
import type { Folder } from 'shim/objects/folder';
import type { TrufosRequest } from 'shim/objects/request';
import type { TrufosResponse } from 'shim/objects/response';

const httpService = HttpService.instance;

/** Sentinel for "no environment" since radix Select does not allow empty item values. */
const NO_ENVIRONMENT = '__none__';

type RunnerItem =
  | {
      type: 'folder';
      id: string;
      title: string;
      depth: number;
      requestIds: string[];
    }
  | {
      type: 'request';
      id: string;
      title: string;
      depth: number;
      request: TrufosRequest;
    };

type RunnerResult =
  | { state: 'running' }
  | { state: 'passed' | 'failed'; response: TrufosResponse }
  | { state: 'error'; error: string; duration: number };

function isFailure(result?: RunnerResult) {
  return result?.state === 'failed' || result?.state === 'error';
}

interface CollectionRunnerProps {
  open: boolean;
  onClose: () => void;
}

function collectRequestIds(folder: Folder, folders: Map<string, Folder>): string[] {
  return folder.children.flatMap((child) => {
    if (child.type === 'request') return child.id;
    const currentFolder = folders.get(child.id) ?? child;
    return collectRequestIds(currentFolder, folders);
  });
}

function buildRunnerItems(
  children: Array<Folder | TrufosRequest>,
  folders: Map<string, Folder>,
  requests: Map<string, TrufosRequest>,
  depth = 0
): RunnerItem[] {
  return children.flatMap((child): RunnerItem[] => {
    if (child.type === 'request') {
      const request = requests.get(child.id) ?? child;
      return [
        {
          type: 'request',
          id: request.id,
          title: request.title || request.url.base,
          depth,
          request,
        },
      ];
    }

    const folder = folders.get(child.id) ?? child;
    return [
      {
        type: 'folder',
        id: folder.id,
        title: folder.title,
        depth,
        requestIds: collectRequestIds(folder, folders),
      },
      ...buildRunnerItems(folder.children, folders, requests, depth + 1),
    ];
  });
}

function isSuccessfulStatus(status: number) {
  return status >= 200 && status < 400;
}

function formatDuration(duration: number) {
  if (duration < 1000) return `${Math.round(duration)} ms`;
  return `${(duration / 1000).toFixed(2)} s`;
}

function formatHeaders(headers: TrufosResponse['headers']) {
  return JSON.stringify(headers, null, 2);
}

function ResponseBodyPreview({ response }: { response: TrufosResponse }) {
  const [body, setBody] = useState('');

  useResponseData(response, 'utf-8', setBody);

  return <pre className="text-xs break-words whitespace-pre-wrap">{body}</pre>;
}

function ResponseDetail({ response }: { response: TrufosResponse }) {
  // Overrides the shadcn defaults to match the compact tab style from the runner design.
  const tabTriggerClassName = cn(
    'h-auto rounded-md px-3 py-1 text-xs font-semibold',
    'data-[state=active]:bg-accent-primary/10 data-[state=active]:text-accent-primary data-[state=active]:shadow-none'
  );
  const tabContentClassName = 'border-border mt-3 min-h-0 rounded border bg-transparent p-3';

  return (
    <div className="grid min-h-[320px] grid-rows-[auto_1fr] gap-3">
      <div className="text-text-secondary flex gap-5 text-sm">
        <span>
          Status:{' '}
          <span className="text-text-primary font-semibold">{response.metaInfo.status}</span>
        </span>
        <span>
          Duration:{' '}
          <span className="text-text-primary font-semibold">
            {formatDuration(response.metaInfo.duration)}
          </span>
        </span>
      </div>
      <Tabs className="min-h-0 bg-transparent" defaultValue="body">
        <TabsList className="h-auto gap-1 bg-transparent">
          <TabsTrigger className={tabTriggerClassName} value="body">
            Body
          </TabsTrigger>
          <TabsTrigger className={tabTriggerClassName} value="headers">
            Headers
          </TabsTrigger>
        </TabsList>
        <TabsContent className={tabContentClassName} value="body">
          <ResponseBodyPreview response={response} />
        </TabsContent>
        <TabsContent className={tabContentClassName} value="headers">
          <pre className="text-xs break-words whitespace-pre-wrap">
            {formatHeaders(response.headers)}
          </pre>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ResultPill({ result }: { result?: RunnerResult }) {
  const pillClassName =
    'inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold';

  if (!result) {
    return (
      <span className={cn(pillClassName, 'bg-background-secondary text-text-secondary')}>
        Pending
      </span>
    );
  }
  if (result.state === 'running') {
    return (
      <span className={cn(pillClassName, 'bg-accent-primary/10 text-accent-primary')}>
        <Loader2 className="h-3 w-3 animate-spin" />
        Running
      </span>
    );
  }
  if (result.state === 'passed') {
    return (
      <span className={cn(pillClassName, 'bg-state-success/10 text-state-success')}>
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        Passed
      </span>
    );
  }
  return (
    <span className={cn(pillClassName, 'bg-danger/10 text-danger')}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      Failed
    </span>
  );
}

export function CollectionRunner({ open, onClose }: CollectionRunnerProps) {
  const collection = useCollectionStore((state) => state.collection);
  const requests = useCollectionStore((state) => state.requests);
  const folders = useCollectionStore((state) => state.folders);
  const { addResponse } = useResponseActions();
  const environments = useEnvironmentStore(selectEnvironments);
  const selectedEnvironment = useEnvironmentStore(selectSelectedEnvironment);
  const { selectEnvironment } = useEnvironmentActions();

  const [selectedRequestIds, setSelectedRequestIds] = useState<Set<string>>(
    () => new Set(requests.keys())
  );
  const [stopOnFirstFailure, setStopOnFirstFailure] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<Record<string, RunnerResult>>({});
  const [runOrder, setRunOrder] = useState<string[]>([]);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [totalDuration, setTotalDuration] = useState<number | null>(null);

  // Incremented to invalidate an in-flight run (stop button, collection switch, unmount).
  const runIdRef = useRef(0);
  const runStartRef = useRef(0);
  const abortSequenceRef = useRef(0);
  const activeRequestAbortKeyRef = useRef<string | undefined>(undefined);
  const knownRequestIdsRef = useRef<Set<string>>(new Set(requests.keys()));
  const requestsRef = useRef(requests);
  requestsRef.current = requests;

  const abortActiveRequest = useCallback(() => {
    const abortKey = activeRequestAbortKeyRef.current;
    if (abortKey == null) return;

    activeRequestAbortKeyRef.current = undefined;
    void httpService.abortRequest(abortKey).catch(console.error);
  }, []);

  useEffect(
    () => () => {
      runIdRef.current++;
      abortActiveRequest();
    },
    [abortActiveRequest]
  );

  // Abort an in-flight run when the runner view is closed.
  useEffect(() => {
    if (!open) {
      runIdRef.current++;
      abortActiveRequest();
      setIsRunning(false);
    }
  }, [abortActiveRequest, open]);

  // Close the runner view with Escape, like the previous dialog did.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    runIdRef.current++;
    abortActiveRequest();
    setSelectedRequestIds(new Set(requestsRef.current.keys()));
    setResults({});
    setRunOrder([]);
    setExpandedRows(new Set());
    setTotalDuration(null);
    setIsRunning(false);
  }, [abortActiveRequest, collection?.id]);

  // Keep the selection in sync when requests are added or removed in the sidebar
  // without discarding the user's choices or any run results.
  useEffect(() => {
    const known = knownRequestIdsRef.current;
    knownRequestIdsRef.current = new Set(requests.keys());
    setSelectedRequestIds((current) => {
      const next = new Set<string>();
      for (const id of requests.keys()) {
        if (current.has(id) || !known.has(id)) next.add(id);
      }
      return next;
    });
  }, [requests]);

  const items = useMemo(
    () => buildRunnerItems(collection?.children ?? [], folders, requests),
    [collection?.children, folders, requests]
  );

  const orderedRequests = useMemo(
    () =>
      items
        .filter((item): item is Extract<RunnerItem, { type: 'request' }> => item.type === 'request')
        .map((item) => item.request),
    [items]
  );

  const selectedRequests = useMemo(
    () => orderedRequests.filter((request) => selectedRequestIds.has(request.id)),
    [orderedRequests, selectedRequestIds]
  );

  const passed = runOrder.filter((id) => results[id]?.state === 'passed').length;
  const failed = runOrder.filter((id) => isFailure(results[id])).length;
  const done = passed + failed;
  const totalRequests = selectedRequests.length;
  // The summary reflects the last run once one exists, the current selection otherwise.
  const totalInRun = runOrder.length > 0 ? runOrder.length : totalRequests;

  const setRequestSelected = (requestId: string, checked: boolean) => {
    setSelectedRequestIds((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(requestId);
      } else {
        next.delete(requestId);
      }
      return next;
    });
  };

  const setRequestsSelected = (requestIds: string[], checked: boolean) => {
    setSelectedRequestIds((current) => {
      const next = new Set(current);
      for (const requestId of requestIds) {
        if (checked) {
          next.add(requestId);
        } else {
          next.delete(requestId);
        }
      }
      return next;
    });
  };

  const toggleExpanded = (requestId: string) => {
    setExpandedRows((current) => {
      const next = new Set(current);
      if (next.has(requestId)) {
        next.delete(requestId);
      } else {
        next.add(requestId);
      }
      return next;
    });
  };

  const runCollection = async () => {
    const runId = ++runIdRef.current;
    const requestsToRun = selectedRequests;
    setIsRunning(true);
    setResults({});
    setRunOrder(requestsToRun.map((request) => request.id));
    setTotalDuration(null);

    const startedAt = performance.now();
    runStartRef.current = startedAt;
    try {
      await Promise.all(editor.getModels().map(saveModelContent));

      for (const request of requestsToRun) {
        if (runIdRef.current !== runId) {
          abortActiveRequest();
          return;
        }
        setResults((current) => ({ ...current, [request.id]: { state: 'running' } }));

        const requestStartedAt = performance.now();
        const abortKey = `${runId}:${request.id}:${abortSequenceRef.current++}`;
        activeRequestAbortKeyRef.current = abortKey;
        try {
          const response = await httpService.sendRequest(request, abortKey);
          if (runIdRef.current !== runId) {
            abortActiveRequest();
            return;
          }
          addResponse(request.id, response);
          const state = isSuccessfulStatus(response.metaInfo.status) ? 'passed' : 'failed';
          setResults((current) => ({ ...current, [request.id]: { state, response } }));

          if (stopOnFirstFailure && state === 'failed') break;
        } catch (error) {
          if (runIdRef.current !== runId) {
            abortActiveRequest();
            return;
          }
          const message = error instanceof Error ? error.message : String(error);
          setResults((current) => ({
            ...current,
            [request.id]: {
              state: 'error',
              error: message,
              duration: performance.now() - requestStartedAt,
            },
          }));

          if (stopOnFirstFailure) break;
        } finally {
          if (activeRequestAbortKeyRef.current === abortKey) {
            activeRequestAbortKeyRef.current = undefined;
          }
        }
      }
    } catch (error) {
      if (runIdRef.current === runId) showError(error);
    } finally {
      if (runIdRef.current === runId) {
        setTotalDuration(performance.now() - startedAt);
        setIsRunning(false);
      }
    }
  };

  const stopRun = () => {
    runIdRef.current++;
    abortActiveRequest();
    setResults({});
    setTotalDuration(performance.now() - runStartRef.current);
    setIsRunning(false);
  };

  if (!open) return null;

  return (
    <div className="grid h-full w-full grid-rows-[auto_auto_1fr_auto] p-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl leading-6 font-semibold">Collection Runner</h2>
          <p className="text-text-secondary mt-1 truncate text-sm">
            {collection?.title ?? 'Current collection'}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-text-secondary">Environment</span>
            <Select
              value={selectedEnvironment ?? NO_ENVIRONMENT}
              onValueChange={(value) =>
                void selectEnvironment(value === NO_ENVIRONMENT ? undefined : value)
              }
              disabled={isRunning}
            >
              <SelectTrigger
                className="border-border h-8 gap-2 rounded-md border px-3"
                aria-label="Select environment"
              >
                <SelectValue placeholder="No environment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_ENVIRONMENT}>No environment</SelectItem>
                {Object.keys(environments).map((key) => (
                  <SelectItem key={key} value={key}>
                    {key}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {isRunning && (
            <>
              <span className="text-text-secondary text-sm tabular-nums">
                {done} / {runOrder.length} done
              </span>
              <Button className="text-danger gap-2" onClick={stopRun} variant="secondary">
                <Square className="h-3.5 w-3.5" />
                Stop
              </Button>
            </>
          )}
          <Button
            className="text-text-secondary hover:text-text-primary"
            variant="ghost"
            size="icon"
            type="button"
            onClick={onClose}
            aria-label="Close collection runner"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className={cn('flex gap-1', runOrder.length > 0 && 'mb-4')}>
        {runOrder.map((requestId) => {
          const result = results[requestId];
          return (
            <span
              key={requestId}
              className={cn(
                'h-1 flex-1 rounded-full',
                result?.state === 'passed' && 'bg-state-success',
                isFailure(result) && 'bg-danger',
                result?.state === 'running' && 'bg-accent-primary animate-pulse',
                result == null && 'bg-border'
              )}
            />
          );
        })}
      </div>

      <div className="grid min-h-0 grid-cols-[minmax(260px,360px)_1fr] gap-6">
        <aside className="border-border bg-sidebar flex min-h-0 flex-col rounded-lg border">
          <div className="border-border flex items-center justify-between border-b px-4 py-3">
            <span className="text-sm font-semibold">Requests</span>
            <div className="flex gap-2 text-xs">
              <button
                className="text-accent-primary cursor-pointer"
                type="button"
                onClick={() =>
                  setRequestsSelected(
                    orderedRequests.map((request) => request.id),
                    true
                  )
                }
              >
                All
              </button>
              <button
                className="text-text-secondary cursor-pointer"
                type="button"
                onClick={() =>
                  setRequestsSelected(
                    orderedRequests.map((request) => request.id),
                    false
                  )
                }
              >
                None
              </button>
            </div>
          </div>

          <div className="tabs-scrollbar min-h-0 flex-1 overflow-y-auto py-2">
            {items.map((item) => {
              if (item.type === 'folder') {
                const checkedCount = item.requestIds.filter((id) =>
                  selectedRequestIds.has(id)
                ).length;
                const checked =
                  checkedCount === 0
                    ? false
                    : checkedCount === item.requestIds.length
                      ? true
                      : 'indeterminate';
                return (
                  <label
                    key={item.id}
                    className={cn(
                      'hover:bg-sidebar-accent flex cursor-pointer items-center gap-1 py-2 pr-4 text-sm',
                      getIndentation(item.depth)
                    )}
                  >
                    <Checkbox
                      className="mr-2"
                      checked={checked}
                      disabled={isRunning || item.requestIds.length === 0}
                      onCheckedChange={(value) =>
                        setRequestsSelected(item.requestIds, value === true)
                      }
                    />
                    <FolderIcon size={16} />
                    <span className="flex-1 truncate">{item.title}</span>
                    <span className="text-text-secondary ml-auto text-xs tabular-nums">
                      {item.requestIds.length}
                    </span>
                  </label>
                );
              }

              return (
                <label
                  key={item.id}
                  className={cn(
                    'hover:bg-sidebar-accent flex cursor-pointer items-center gap-3 py-3.5 pr-4',
                    getIndentation(item.depth)
                  )}
                >
                  <Checkbox
                    checked={selectedRequestIds.has(item.id)}
                    disabled={isRunning}
                    onCheckedChange={(value) => setRequestSelected(item.id, value === true)}
                  />
                  <span
                    className={cn(
                      'shrink-0 text-xs leading-3 font-normal',
                      httpMethodColor(item.request.method)
                    )}
                  >
                    {item.request.method}
                  </span>
                  <span className="font-lato flex-1 truncate text-xs leading-3 text-(--text-secondary)">
                    {item.title}
                  </span>
                </label>
              );
            })}
          </div>

          <div className="border-border space-y-4 border-t p-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={stopOnFirstFailure}
                disabled={isRunning}
                onCheckedChange={(value) => setStopOnFirstFailure(value === true)}
              />
              Stop on first failure
            </label>

            <Button
              className="w-full gap-2"
              disabled={isRunning || selectedRequests.length === 0}
              onClick={runCollection}
            >
              {isRunning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {isRunning
                ? 'Running'
                : `Run ${totalRequests} ${totalRequests === 1 ? 'request' : 'requests'}`}
            </Button>
          </div>
        </aside>

        <main className="border-border bg-card flex min-h-0 flex-col rounded-lg border">
          <div className="border-border text-text-secondary grid grid-cols-[minmax(180px,1fr)_90px_100px_90px] gap-4 border-b px-4 py-3 text-xs font-semibold tracking-wide uppercase">
            <span>Name</span>
            <span>Status</span>
            <span>Result</span>
            <span>Time</span>
          </div>

          <div className="tabs-scrollbar min-h-0 flex-1 overflow-y-auto">
            {orderedRequests.map((request) => {
              const result = results[request.id];
              const response =
                result?.state === 'passed' || result?.state === 'failed'
                  ? result.response
                  : undefined;
              const isExpanded = expandedRows.has(request.id);
              const isSelected = selectedRequestIds.has(request.id);
              const duration =
                response?.metaInfo.duration ??
                (result?.state === 'error' ? result.duration : undefined);
              return (
                <Collapsible
                  key={request.id}
                  open={isExpanded}
                  onOpenChange={() => toggleExpanded(request.id)}
                >
                  <CollapsibleTrigger asChild>
                    <button
                      className={cn(
                        'hover:bg-sidebar-accent grid w-full grid-cols-[minmax(180px,1fr)_90px_100px_90px] items-center gap-4 border-b px-4 py-3 text-left text-sm',
                        !isSelected && 'opacity-50'
                      )}
                      type="button"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 shrink-0" />
                        ) : (
                          <ChevronRight className="h-4 w-4 shrink-0" />
                        )}
                        <span
                          className={cn(
                            'w-12 shrink-0 text-xs font-bold',
                            httpMethodColor(request.method)
                          )}
                        >
                          {request.method}
                        </span>
                        <span className="truncate">{request.title || request.url.base}</span>
                      </span>
                      <span className="tabular-nums">{response?.metaInfo.status ?? '-'}</span>
                      <ResultPill result={result} />
                      <span className="tabular-nums">
                        {duration == null ? '-' : formatDuration(duration)}
                      </span>
                    </button>
                  </CollapsibleTrigger>

                  <CollapsibleContent className="border-border bg-background-secondary/40 border-b px-4 py-4">
                    {result == null ? (
                      <p className="text-text-secondary text-sm">No result yet.</p>
                    ) : result.state === 'error' ? (
                      <p className="text-danger text-sm">{result.error}</p>
                    ) : result.state === 'running' ? (
                      <p className="text-text-secondary text-sm">Request is running.</p>
                    ) : (
                      <ResponseDetail response={result.response} />
                    )}
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        </main>
      </div>

      <div className="flex items-center gap-3 pt-4">
        <div className="border-border bg-card flex items-baseline gap-2 rounded-lg border px-3.5 py-1.5">
          <span className="text-base font-bold tabular-nums">{totalInRun}</span>
          <span className="text-text-secondary text-xs">total</span>
        </div>
        <div className="border-border bg-card flex items-baseline gap-2 rounded-lg border px-3.5 py-1.5">
          <span className="text-state-success text-base font-bold tabular-nums">{passed}</span>
          <span className="text-text-secondary text-xs">passed</span>
        </div>
        <div className="border-border bg-card flex items-baseline gap-2 rounded-lg border px-3.5 py-1.5">
          <span className="text-danger text-base font-bold tabular-nums">{failed}</span>
          <span className="text-text-secondary text-xs">failed</span>
        </div>
        <span className="text-text-secondary ml-auto text-sm tabular-nums">
          Elapsed {totalDuration == null ? '-' : formatDuration(totalDuration)}
        </span>
      </div>
    </div>
  );
}
