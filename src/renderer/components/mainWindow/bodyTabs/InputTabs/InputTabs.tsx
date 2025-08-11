import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMemo, useState, useEffect } from 'react';
import { selectRequest, useCollectionStore } from '@/state/collectionStore';
import { HeaderTab } from '@/components/mainWindow/bodyTabs/InputTabs/tabs/HeaderTab/HeaderTab';
import { BodyTab } from '@/components/mainWindow/bodyTabs/InputTabs/tabs/BodyTab';
import { ParamsTab } from '@/components/mainWindow/bodyTabs/InputTabs/tabs/ParamsTab';
import { AuthorizationTab } from '@/components/mainWindow/bodyTabs/InputTabs/tabs/AuthorizationTab/AuthorizationTab';

interface InputTabsProps {
  className: string;
  activeTab?: number;
  onTabChange?: (tabIndex: number) => void;
}

const TAB_VALUES = ['body', 'queryParams', 'headers', 'authorization'];

export function InputTabs(props: Readonly<InputTabsProps>) {
  const { className, activeTab, onTabChange } = props;
  const [currentTab, setCurrentTab] = useState('body');

  const headers = useCollectionStore((state) => selectRequest(state).headers);

  const activeRowCount = useMemo(
    () => headers.filter((header) => header.isActive).length,
    [headers]
  );

  // Handle programmatic tab changes
  useEffect(() => {
    if (activeTab !== undefined && TAB_VALUES[activeTab]) {
      setCurrentTab(TAB_VALUES[activeTab]);
    }
  }, [activeTab]);

  const handleTabChange = (value: string) => {
    setCurrentTab(value);
    const tabIndex = TAB_VALUES.indexOf(value);
    if (tabIndex !== -1) {
      onTabChange?.(tabIndex);
    }
  };

  return (
    <Tabs className={className} value={currentTab} onValueChange={handleTabChange}>
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
