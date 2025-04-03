import React from 'react';
import { Sidebar } from '@/components/ui/sidebar';
import { FooterBar } from '@/components/sidebar/FooterBar';
import { SidebarHeaderBar } from '@/components/sidebar/SidebarHeaderBar';
import { SidebarRequestList } from '@/components/sidebar/SidebarRequestList/SidebarRequestList';

export const Menubar = () => {
  return (
    <div>
      <Sidebar collapsible={'none'}>
        <SidebarHeaderBar />
        <SidebarRequestList />
        <FooterBar />
      </Sidebar>
    </div>
  );
};
