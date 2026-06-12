import { useEffect, useMemo, useState } from 'react';
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
import { selectResponse, useResponseStore } from '@/state/responseStore';
import { selectRequest, useCollectionStore } from '@/state/collectionStore';
import { BodyTab } from './OutputTabs/BodyTab';

interface OutputTabsProps {
  className: string;
}

type OutputTabValue = 'body' | 'header';

export function OutputTabs({ className }: OutputTabsProps) {
  const [selectedTab, setSelectedTab] = useState<OutputTabValue>('body');

  const requestId = useCollectionStore((state) => selectRequest(state)?.id);
  const response = useResponseStore((state) => selectResponse(state, requestId));

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isModifierPressed = event.ctrlKey || event.metaKey;

      if (!isModifierPressed) return;

      const tabMap: Record<string, OutputTabValue> = {
        '6': 'body',
        '7': 'header',
      };

      const nextTab = tabMap[event.key];

      if (!nextTab) return;

      event.preventDefault();
      setSelectedTab(nextTab);
    };

    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, []);

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
    </Tabs>
  );
}
