import { ReactNode, useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HeadersTable, KeyValueTable } from '@/components/shared/HeadersTable';
import { HistoryEntry } from 'shim/history';
import { BodyTab } from '@/components/mainWindow/bodyTabs/OutputTabs/BodyTab';
import { useTemporaryModel } from '@/hooks/useTemporaryModel';
import { cn } from '@/lib/utils';
import { ScriptLogs } from './ScriptLogs';

type HistoryRequestTabValue = 'body' | 'queryParams' | 'headers' | 'console';

export interface HistoryRequestTabsProps {
  className: string;
  entry: HistoryEntry;
}

/**
 * Shows the request of a history entry read-only, in the same tabs as the request editor. As the
 * request is shown exactly as it was sent, authorization is part of its headers and the scripts are
 * represented by their output.
 */
export function HistoryRequestTabs({ className, entry }: HistoryRequestTabsProps) {
  const [selectedTab, setSelectedTab] = useState<HistoryRequestTabValue>('body');
  const bodyModel = useTemporaryModel();
  const { request, scriptLogs } = entry;
  const queryParams = useMemo(() => getQueryParams(entry.url), [entry.url]);
  const headerCount = request == null ? 0 : Object.keys(request.headers).length;

  const notSent = <Placeholder>The request was not sent.</Placeholder>;

  return (
    <Tabs
      className={className}
      value={selectedTab}
      onValueChange={(value) => setSelectedTab(value as HistoryRequestTabValue)}
    >
      <TabsList>
        <TabsTrigger value="body">Body</TabsTrigger>
        <TabsTrigger value="queryParams">{withCount('Parameters', queryParams.length)}</TabsTrigger>
        <TabsTrigger value="headers">{withCount('Headers', headerCount)}</TabsTrigger>
        <TabsTrigger value="console">{withCount('Console', scriptLogs.length)}</TabsTrigger>
      </TabsList>

      <TabsContent
        value="body"
        className={cn('flex h-full min-h-0 flex-col', request?.body == null && 'p-4')}
      >
        {request == null ? (
          notSent
        ) : request.body == null ? (
          <Placeholder>The request had no body.</Placeholder>
        ) : (
          <BodyTab body={request.body} headers={request.headers} model={bodyModel} />
        )}
      </TabsContent>

      <TabsContent value="queryParams" className="p-4">
        {queryParams.length === 0 ? (
          <Placeholder>The request had no query parameters.</Placeholder>
        ) : (
          <KeyValueTable rows={queryParams} aria-label="Query parameters" />
        )}
      </TabsContent>

      <TabsContent value="headers" className="p-4">
        {request == null ? (
          notSent
        ) : (
          <HeadersTable headers={request.headers} aria-label="Request headers" />
        )}
      </TabsContent>

      <TabsContent value="console" className="p-4">
        {scriptLogs.length === 0 ? (
          <Placeholder>The scripts of this request did not log anything.</Placeholder>
        ) : (
          <ScriptLogs logs={scriptLogs} />
        )}
      </TabsContent>
    </Tabs>
  );
}

const Placeholder = ({ children }: { children: ReactNode }) => (
  <p className="text-text-secondary p-2 text-sm">{children}</p>
);

function withCount(label: string, count: number) {
  return count === 0 ? label : `${label} (${count})`;
}

/**
 * @param url the URL the request was sent to
 * @returns its decoded query parameters, or none if it is not a valid URL, e.g. because the request
 * failed before its variables were resolved
 */
function getQueryParams(url: string): [string, string][] {
  return URL.canParse(url) ? [...new URL(url).searchParams] : [];
}
