import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMemo, useState } from 'react';
import { selectRequest, useCollectionStore } from '@/state/collectionStore';
import { HeaderTab } from '@/components/mainWindow/bodyTabs/InputTabs/tabs/HeaderTab/HeaderTab';
import { BodyTab } from '@/components/mainWindow/bodyTabs/InputTabs/tabs/BodyTab';
import { ParamsTab } from '@/components/mainWindow/bodyTabs/InputTabs/tabs/ParamsTab';
import { AuthorizationTab } from '@/components/mainWindow/bodyTabs/InputTabs/tabs/AuthorizationTab/AuthorizationTab';
import { ScriptTab } from '@/components/mainWindow/bodyTabs/InputTabs/tabs/ScriptTab';
import { useHotkeys } from '@/hooks/hotKeys/useHotkey';

interface InputTabsProps {
  className: string;
}

type InputTabValue = 'body' | 'queryParams' | 'headers' | 'authorization' | 'scripts';

export function InputTabs(props: Readonly<InputTabsProps>) {
  const { className } = props;

  const [selectedTab, setSelectedTab] = useState<InputTabValue>('body');

  const headers = useCollectionStore((state) => selectRequest(state)!.headers);
  const queryParams = useCollectionStore((state) => selectRequest(state)!.url.query);

  const activeHeaderCount = useMemo(
    () => headers.filter((header) => header.isActive).length,
    [headers]
  );

  const activeParamsCount = useMemo(
    () => queryParams.filter((param) => param.isActive).length,
    [queryParams]
  );

  useHotkeys(
    [
      {
        keys: 'mod+1',
        handler: () => setSelectedTab('body'),
      },
      {
        keys: 'mod+2',
        handler: () => setSelectedTab('queryParams'),
      },
      {
        keys: 'mod+3',
        handler: () => setSelectedTab('headers'),
      },
      {
        keys: 'mod+4',
        handler: () => setSelectedTab('authorization'),
      },
      {
        keys: 'mod+5',
        handler: () => setSelectedTab('scripts'),
      },
    ],
    { skipFormElements: false }
  );

  return (
    <Tabs
      className={className}
      defaultValue="body"
      value={selectedTab}
      onValueChange={(value) => setSelectedTab(value as InputTabValue)}
    >
      <TabsList>
        <TabsTrigger value="body">Body</TabsTrigger>
        <TabsTrigger value="queryParams">
          {activeParamsCount === 0 ? 'Parameters' : `Parameters (${activeParamsCount})`}
        </TabsTrigger>

        <TabsTrigger value="headers">
          {activeHeaderCount === 0 ? 'Headers' : `Headers (${activeHeaderCount})`}
        </TabsTrigger>
        <TabsTrigger value="authorization">Auth</TabsTrigger>
        <TabsTrigger value="scripts">Scripts</TabsTrigger>
      </TabsList>

      <TabsContent value="body">
        <BodyTab />
      </TabsContent>

      <TabsContent value="queryParams">
        <ParamsTab />
      </TabsContent>

      <TabsContent value="headers">
        <HeaderTab />
      </TabsContent>

      <TabsContent value="authorization">
        <AuthorizationTab />
      </TabsContent>

      <TabsContent value="scripts">
        <ScriptTab />
      </TabsContent>
    </Tabs>
  );
}
