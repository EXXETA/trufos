import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMemo } from 'react';
import { selectRequest, useCollectionStore } from '@/state/collectionStore';
import { HeaderTab } from '@/components/mainWindow/bodyTabs/InputTabs/tabs/HeaderTab/HeaderTab';
import { BodyTab } from '@/components/mainWindow/bodyTabs/InputTabs/tabs/BodyTab';
import { ParamsTab } from '@/components/mainWindow/bodyTabs/InputTabs/tabs/ParamsTab';
import { AuthorizationTab } from '@/components/mainWindow/bodyTabs/InputTabs/tabs/AuthorizationTab/AuthorizationTab';
import { ScriptTab } from '@/components/mainWindow/bodyTabs/InputTabs/tabs/ScriptTab';

interface InputTabsProps {
  className: string;
}

export function InputTabs(props: Readonly<InputTabsProps>) {
  const { className } = props;

  const headers = useCollectionStore((state) => selectRequest(state).headers);
  const queryParams = useCollectionStore((state) => selectRequest(state).url.query);

  const activeHeaderCount = useMemo(
    () => headers.filter((header) => header.isActive).length,
    [headers]
  );

  const activeParamsCount = useMemo(
    () => queryParams.filter((param) => param.isActive).length,
    [queryParams]
  );

  return (
    <Tabs className={className} defaultValue="body">
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
