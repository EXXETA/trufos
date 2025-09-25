import { InputTabs } from '@/components/mainWindow/bodyTabs/InputTabs/InputTabs';
import { OutputTabs } from '@/components/mainWindow/bodyTabs/OutputTabs';
import { useState, useCallback } from 'react';
import { useGlobalHotkeys } from '@/hooks/useGlobalHotkeys';

export function MainBody() {
  const [activeRequestTab, setActiveRequestTab] = useState<number | undefined>();
  const [activeResponseTab, setActiveResponseTab] = useState<number | undefined>();

  const handleRequestTabSwitch = useCallback((tabIndex: number) => {
    setActiveRequestTab(tabIndex);
    setTimeout(() => setActiveRequestTab(undefined), 100);
  }, []);

  const handleResponseTabSwitch = useCallback((tabIndex: number) => {
    setActiveResponseTab(tabIndex);
    setTimeout(() => setActiveResponseTab(undefined), 100);
  }, []);

  useGlobalHotkeys({
    onSwitchRequestTab: handleRequestTabSwitch,
    onSwitchResponseTab: handleResponseTabSwitch,
  });

  return (
    <div className="grid h-full grid-rows-[48%_48%] gap-6 xl:grid-cols-2 xl:grid-rows-1">
      <InputTabs
        className="min-h-0 min-w-0"
        activeTab={activeRequestTab}
        onTabChange={() => setActiveRequestTab(undefined)}
      />
      <OutputTabs
        className="min-h-0 min-w-0"
        activeTab={activeResponseTab}
        onTabChange={() => setActiveResponseTab(undefined)}
      />
    </div>
  );
}
