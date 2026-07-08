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
import { ResizablePanel, ResizablePanelGroup, ResizableHandle } from '@/components/ui/resizable';
import { useResponseData } from '@/components/mainWindow/bodyTabs/OutputTabs/PrettyRenderer';
import { FolderIcon, SmallArrow } from '@/components/icons';
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

// Same constraints as the main layout in App so the rail matches the sidebar.
const MIN_SIDEBAR_PIXELS = 300;
const MIN_RESULTS_PIXELS = 500;

type RunnerItem =
  | {
      type: 'folder';
      id: string;
      title: string;
      depth: number;
      /** Ids of all folders this item is nested in */
      ancestors: string[];
      requestIds: string[];
    }
  | {
      type: 'request';
      id: string;
      title: string;
      depth: number;
      /** Ids of all folders this item is nested in */
      ancestors: string[];
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
  depth = 0,
  ancestors: string[] = []
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
          ancestors,
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
        ancestors,
        requestIds: collectRequestIds(folder, folders),
      },
      ...buildRunnerItems(folder.children, folders, requests, depth + 1, [...ancestors, folder.id]),
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
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
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
    setCollapsedFolders(new Set());
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

  // Items inside a collapsed folder are hidden from the checklist but stay selected.
  const visibleItems = useMemo(
    () => items.filter((item) => !item.ancestors.some((id) => collapsedFolders.has(id))),
    [items, collapsedFolders]
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

  // The progress bar shows the last run once one exists, the current selection otherwise.
  const progressIds =
    runOrder.length > 0 ? runOrder : selectedRequests.map((request) => request.id);

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

  const toggleFolderCollapsed = (folderId: string) => {
    setCollapsedFolders((current) => {
      const next = new Set(current);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
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
    <ResizablePanelGroup orientation="horizontal" className="h-full w-full">
      <ResizablePanel defaultSize="25%" minSize={MIN_SIDEBAR_PIXELS}>
        <aside className="bg-sidebar flex h-full flex-col">
          <div className="border-border flex items-center gap-2 border-b px-4 py-3">
            <span className="text-text-secondary shrink-0 text-xs">Environment</span>
            <Select
              value={selectedEnvironment ?? NO_ENVIRONMENT}
              onValueChange={(value) =>
                void selectEnvironment(value === NO_ENVIRONMENT ? undefined : value)
              }
              disabled={isRunning}
            >
              <SelectTrigger
                className="border-border h-7 w-auto min-w-0 flex-1 gap-2 rounded-md border px-2 text-xs"
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
            <Button
              className="text-text-secondary hover:text-text-primary shrink-0"
              variant="ghost"
              size="icon"
              type="button"
              onClick={onClose}
              aria-label="Close collection runner"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

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
            {visibleItems.map((item) => {
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
                const isCollapsed = collapsedFolders.has(item.id);
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
                    <button
                      className={cn(
                        'h-6 w-6 shrink-0 cursor-pointer transition-transform duration-300 ease-in-out',
                        isCollapsed ? 'rotate-270' : 'rotate-0'
                      )}
                      type="button"
                      aria-label={isCollapsed ? `Expand ${item.title}` : `Collapse ${item.title}`}
                      aria-expanded={!isCollapsed}
                      onClick={(event) => {
                        event.preventDefault();
                        toggleFolderCollapsed(item.id);
                      }}
                    >
                      <SmallArrow size={24} />
                    </button>
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

            {isRunning ? (
              <Button className="text-danger w-full gap-2" onClick={stopRun} variant="secondary">
                <Square className="h-3.5 w-3.5" />
                Stop run
              </Button>
            ) : (
              <Button
                className="w-full gap-2"
                disabled={selectedRequests.length === 0}
                onClick={runCollection}
              >
                <Play className="h-4 w-4" />
                {`Run ${totalRequests} ${totalRequests === 1 ? 'request' : 'requests'}`}
              </Button>
            )}
          </div>
        </aside>
      </ResizablePanel>

      <ResizableHandle />

      <ResizablePanel defaultSize="75%" minSize={MIN_RESULTS_PIXELS}>
        <div className="grid h-full grid-rows-[auto_auto_1fr_auto] p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-xl leading-6 font-semibold">Collection Runner</h2>
              <p className="text-text-secondary mt-1 truncate text-sm">
                {collection?.title ?? 'Current collection'}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-3">
              {isRunning && (
                <span className="text-text-secondary text-sm tabular-nums">
                  {done} / {runOrder.length} done
                </span>
              )}
            </div>
          </div>

          {/* Before the first run the bar previews one neutral segment per selected request. */}
          <div className="mb-4 flex gap-1">
            {progressIds.length === 0 ? (
              <span className="bg-border h-1 flex-1 rounded-full" />
            ) : (
              progressIds.map((requestId) => {
                const result = runOrder.length > 0 ? results[requestId] : undefined;
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
              })
            )}
          </div>

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
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
