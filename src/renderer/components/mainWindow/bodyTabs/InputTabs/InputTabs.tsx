import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useEffect, useMemo, useState } from 'react';
import { selectRequest, useCollectionStore } from '@/state/collectionStore';
import { HeaderTab } from '@/components/mainWindow/bodyTabs/InputTabs/tabs/HeaderTab/HeaderTab';
import { BodyTab } from '@/components/mainWindow/bodyTabs/InputTabs/tabs/BodyTab';
import { ParamsTab } from '@/components/mainWindow/bodyTabs/InputTabs/tabs/ParamsTab';
import { AuthorizationTab } from '@/components/mainWindow/bodyTabs/InputTabs/tabs/AuthorizationTab/AuthorizationTab';
import { ScriptTab } from '@/components/mainWindow/bodyTabs/InputTabs/tabs/ScriptTab';

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

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;

      if (
        target.nodeName === 'INPUT' ||
        target.nodeName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      const isModifierPressed = event.ctrlKey || event.metaKey;

      if (!isModifierPressed) return;

      const tabMap: Record<string, InputTabValue> = {
        '1': 'body',
        '2': 'queryParams',
        '3': 'headers',
        '4': 'authorization',
        '5': 'scripts',
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
