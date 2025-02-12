import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCallback } from 'react';
import { selectRequest, useCollectionStore } from '@/state/collectionStore';
import { HeaderTab } from '@/components/mainWindow/bodyTabs/InputTabs/tabs/HeaderTab';
import { BodyTab } from '@/components/mainWindow/bodyTabs/InputTabs/tabs/BodyTab';

interface InputTabsProps {
  className: string;
}

export function InputTabs(props: InputTabsProps) {
  const { className } = props;

  const headers = useCollectionStore((state) => selectRequest(state).headers);

  const getActiveRowCount = useCallback(
    () => headers.filter((header) => header.isActive).length,
    [headers]
  );

  return (
    <Tabs className={className} defaultValue="body">
      <TabsList>
        <TabsTrigger value="body">Body</TabsTrigger>
        {/*<TabsTrigger value="queryParams">Query</TabsTrigger>*/}
        <TabsTrigger value="headers">
          {getActiveRowCount() === 0 ? 'Headers' : `Headers (${getActiveRowCount()})`}
        </TabsTrigger>
        {/*<TabsTrigger value="authorization">Auth</TabsTrigger>*/}
      </TabsList>

      <TabsContent value="body">
        <BodyTab />
      </TabsContent>

      <TabsContent value="queryParams">Change your queryParams here.</TabsContent>

      <TabsContent value="headers">
        <HeaderTab />
      </TabsContent>

      <TabsContent value="authorization">Change your authorization here.</TabsContent>
    </Tabs>
  );
}
