import React, { useEffect, useState } from 'react';
import { Sidebar } from '@/components/ui/sidebar';
import { FooterBar } from '@/components/sidebar/FooterBar';
import { SidebarHeaderBar } from '@/components/sidebar/SidebarHeaderBar';
import { SidebarRequestList } from '@/components/sidebar/SidebarRequestList/SidebarRequestList';
import type { CreatingItem } from '@/components/sidebar/SidebarRequestList/types';
import {
  selectPendingCreateItem,
  selectSidebarView,
  useViewActions,
  useViewStore,
} from '@/state/viewStore';
import { HistoryList } from '@/components/history/HistoryList';

export const Menubar = () => {
  const [creatingItem, setCreatingItem] = useState<CreatingItem>(null);

  // Bridge: sources with no prop path to this local state (e.g. the Command Palette, a sibling
  // under App.tsx's SidebarProvider, or the sidebar header) request an item via viewStore; this
  // consumes the one-shot request and clears it back to null immediately.
  const pendingCreateItem = useViewStore(selectPendingCreateItem);
  const { requestCreateItem } = useViewActions();
  const sidebarView = useViewStore(selectSidebarView);

  useEffect(() => {
    if (pendingCreateItem) {
      setCreatingItem(pendingCreateItem);
      requestCreateItem(null);
    }
  }, [pendingCreateItem, requestCreateItem]);

  return (
    <Sidebar className={'flex h-screen flex-col p-6'} collapsible={'none'}>
      <SidebarHeaderBar />
      {sidebarView === 'requests' ? (
        <SidebarRequestList creatingItem={creatingItem} onCreateItem={setCreatingItem} />
      ) : (
        <HistoryList />
      )}
      <FooterBar />
    </Sidebar>
  );
};
