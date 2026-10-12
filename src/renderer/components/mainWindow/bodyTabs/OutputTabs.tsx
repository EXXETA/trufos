import { useState } from 'react';
import { editor } from 'monaco-editor';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HeadersTable } from '@/components/shared/HeadersTable';
import { ResponseStatus } from '@/components/mainWindow/responseStatus/ResponseStatus';
import { selectResponse, useResponseStore } from '@/state/responseStore';
import { selectRequest, useCollectionStore } from '@/state/collectionStore';
import { getResponseModel } from '@/lib/monaco/models';
import { BodyTab } from './OutputTabs/BodyTab';
import { useHotkeys } from '@/hooks/hotKeys/useHotkey';
import { HOTKEYS } from '@/hooks/hotKeys/hotkeys';
import { ReceivedResponse } from 'shim/objects/response';

interface OutputTabsProps {
  className: string;
}

/** Shows the latest response of the selected request. */
export function OutputTabs({ className }: OutputTabsProps) {
  const requestId = useCollectionStore((state) => selectRequest(state)?.id);
  const response = useResponseStore((state) => selectResponse(state, requestId));

  if (requestId == null || response == null) {
    return (
      <div className="flex h-full w-full items-center justify-center text-center">
        <span>Send a request to get a response :)</span>
      </div>
    );
  }

  return (
    <ResponseTabs className={className} response={response} model={getResponseModel(requestId)} />
  );
}

type OutputTabValue = 'body' | 'header';

export interface ResponseTabsProps {
  className: string;
  response: ReceivedResponse;
  /** The model textual bodies are shown in. */
  model: editor.ITextModel;
}

/** Shows a response: its body, its headers and its status. */
export function ResponseTabs({ className, response, model }: ResponseTabsProps) {
  const [selectedTab, setSelectedTab] = useState<OutputTabValue>('body');

  useHotkeys([
    {
      keys: HOTKEYS.selectResponseBodyTab,
      handler: () => setSelectedTab('body'),
    },
    {
      keys: HOTKEYS.selectResponseHeadersTab,
      handler: () => setSelectedTab('header'),
    },
  ]);

  return (
    <Tabs
      className={className}
      defaultValue="body"
      value={selectedTab}
      onValueChange={(value) => setSelectedTab(value as OutputTabValue)}
    >
      <TabsList className="flex items-center justify-between">
        <div className="flex">
          <TabsTrigger value="body">Response Body</TabsTrigger>
          <TabsTrigger value="header">Headers</TabsTrigger>
        </div>
        <ResponseStatus metaInfo={response.metaInfo} />
      </TabsList>

      <TabsContent value="body" className="flex h-full min-h-0 flex-col">
        <BodyTab body={response.body} headers={response.headers} model={model} />
      </TabsContent>

      <TabsContent value="header" className="p-4">
        <div className="h-0">
          <HeadersTable headers={response.headers} aria-label="Response headers" />
        </div>
      </TabsContent>
    </Tabs>
  );
}
