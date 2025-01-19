import React from 'react';
import { SidebarRequestList } from '@/components/sidebar/SidebarRequestList';
import { Sidebar } from '@/components/ui/sidebar';
import { FooterBar } from '@/components/sidebar/FooterBar';
import { SidebarHeaderBar } from '@/components/sidebar/SidebarHeaderBar';

export const Menubar = () => {
  return (
    <div>
      <Sidebar collapsible={'none'}>
        <SidebarHeaderBar></SidebarHeaderBar>
        <SidebarRequestList />
        <FooterBar />
      </Sidebar>
    </div>
  );
};
