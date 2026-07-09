import React, { useState } from 'react';
import { Sidebar } from '@/components/ui/sidebar';
import { FooterBar } from '@/components/sidebar/FooterBar';
import { SidebarHeaderBar } from '@/components/sidebar/SidebarHeaderBar';
import { SidebarRequestList } from '@/components/sidebar/SidebarRequestList/SidebarRequestList';
import { HistoryPanel } from '@/view/HistoryPanel';
import { selectSidebarTab, useViewStore } from '@/state/viewStore';
import type { CreatingItem } from '@/components/sidebar/SidebarRequestList/types';

export const Menubar = () => {
  const [creatingItem, setCreatingItem] = useState<CreatingItem>(null);
  const sidebarTab = useViewStore(selectSidebarTab);

  return (
    <Sidebar className={'flex h-screen flex-col p-6'} collapsible={'none'}>
      {sidebarTab === 'requests' ? (
        <>
          <SidebarHeaderBar onCreateItem={setCreatingItem} />
          <SidebarRequestList creatingItem={creatingItem} onCreateItem={setCreatingItem} />
        </>
      ) : (
        // The history view intentionally hides the header bar so the collection
        // cannot be switched while browsing the history of the current one.
        <HistoryPanel />
      )}
      <FooterBar />
    </Sidebar>
  );
};
