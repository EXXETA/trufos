import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMemo } from 'react';
import { selectRequest, useCollectionStore } from '@/state/collectionStore';
import { HeaderTab } from '@/components/mainWindow/bodyTabs/InputTabs/tabs/HeaderTab/HeaderTab';
import { BodyTab } from '@/components/mainWindow/bodyTabs/InputTabs/tabs/BodyTab';
import { ParamsTab } from '@/components/mainWindow/bodyTabs/InputTabs/tabs/ParamsTab';
import { AuthorizationTab } from '@/components/mainWindow/bodyTabs/InputTabs/tabs/AuthorizationTab/AuthorizationTab';

interface InputTabsProps {
  className: string;
}

export function InputTabs(props: Readonly<InputTabsProps>) {
  const { className } = props;

  const headers = useCollectionStore((state) => selectRequest(state).headers);

  const activeRowCount = useMemo(
    () => headers.filter((header) => header.isActive).length,
    [headers]
  );

  return (
    <Tabs className={className} defaultValue="body">
      <TabsList>
        <TabsTrigger value="body">Body</TabsTrigger>
        <TabsTrigger value="queryParams">Params</TabsTrigger>
        <TabsTrigger value="headers">
          {activeRowCount === 0 ? 'Headers' : `Headers (${activeRowCount})`}
        </TabsTrigger>
        <TabsTrigger value="authorization">Auth</TabsTrigger>
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
    </Tabs>
  );
}
