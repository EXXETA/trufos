import React, { useState } from 'react';
import { Sidebar } from '@/components/ui/sidebar';
import { FooterBar } from '@/components/sidebar/FooterBar';
import { SidebarHeaderBar } from '@/components/sidebar/SidebarHeaderBar';
import { SidebarRequestList } from '@/components/sidebar/SidebarRequestList/SidebarRequestList';
import type { CreatingItem } from '@/components/sidebar/SidebarRequestList/types';

export const Menubar = () => {
  const [creatingItem, setCreatingItem] = useState<CreatingItem>(null);

  return (
    <Sidebar className={'flex h-screen flex-col p-6'} collapsible={'none'}>
      <SidebarHeaderBar onCreateItem={setCreatingItem} />
      <SidebarRequestList creatingItem={creatingItem} onCreateItem={setCreatingItem} />
      <FooterBar />
    </Sidebar>
  );
};
