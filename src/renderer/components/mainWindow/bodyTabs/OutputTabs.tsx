import { useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ResponseStatus } from '@/components/mainWindow/responseStatus/ResponseStatus';
import { selectAssertionResults, selectResponse, useResponseStore } from '@/state/responseStore';
import { selectRequest, useCollectionStore } from '@/state/collectionStore';
import { BodyTab } from './OutputTabs/BodyTab';
import { useHotkeys } from '@/hooks/hotKeys/useHotkey';

interface OutputTabsProps {
  className: string;
}

type OutputTabValue = 'body' | 'header' | 'assertions';

export function OutputTabs({ className }: OutputTabsProps) {
  const [selectedTab, setSelectedTab] = useState<OutputTabValue>('body');

  const requestId = useCollectionStore((state) => selectRequest(state)?.id);
  const response = useResponseStore((state) => selectResponse(state, requestId));
  const assertionResults = useResponseStore((state) => selectAssertionResults(state, requestId));

  useHotkeys([
    {
      keys: 'mod+6',
      handler: () => setSelectedTab('body'),
    },
    {
      keys: 'mod+7',
      handler: () => setSelectedTab('header'),
    },
    {
      keys: 'mod+9',
      handler: () => setSelectedTab('assertions'),
    },
  ]);

  if (response == null) {
    return (
      <div className="flex h-full w-full items-center justify-center text-center">
        <span>Send a request to get a response :)</span>
      </div>
    );
  }

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
          <TabsTrigger value="assertions">
            {assertionResults == null || assertionResults.length === 0
              ? 'Assertions'
              : `Assertions (${assertionResults.filter((result) => result.passed).length}/${assertionResults.length})`}
          </TabsTrigger>
        </div>
        <ResponseStatus />
      </TabsList>

      <TabsContent value="body" className="flex h-full min-h-0 flex-col">
        <BodyTab />
      </TabsContent>

      <TabsContent value="header" className="p-4">
        <div className="h-0">
          <Table className="w-full table-auto">
            <TableHeader>
              <TableRow>
                <TableHead className="w-auto">Key</TableHead>
                <TableHead className="w-full">Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(response.headers).map(([key, value]) => (
                <TableRow key={key}>
                  <TableCell className="w-1/3">{key}</TableCell>
                  <TableCell>{Array.isArray(value) ? value.join(', ') : value}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </TabsContent>

      <TabsContent value="assertions" className="p-4">
        <div className="h-0">
          <Table className="w-full table-auto">
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Result</TableHead>
                <TableHead className="w-1/3">Assertion</TableHead>
                <TableHead className="w-full">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(assertionResults ?? []).map((result) => (
                <TableRow key={result.assertionId}>
                  <TableCell>
                    <div className="flex items-center gap-2 whitespace-nowrap">
                      {result.passed ? (
                        <CheckCircle2 className="text-state-success h-4 w-4 shrink-0" />
                      ) : (
                        <XCircle className="text-danger h-4 w-4 shrink-0" />
                      )}
                      {result.passed ? 'Pass' : 'Fail'}
                    </div>
                  </TableCell>
                  <TableCell>{result.name}</TableCell>
                  <TableCell>{result.message}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </TabsContent>
    </Tabs>
  );
}
