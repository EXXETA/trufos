import React from 'react';
import { Divider } from '@/components/shared/Divider';
import { SidebarRequestList } from '@/components/sidebar/SidebarRequestList';
import { FooterBar } from '@/components/sidebar/FooterBar';
import { SidebarSearch } from '@/components/sidebar/SidebarSearch';

export const Sidebar = () => {
  return (
    <div className="flex-none flex flex-col gap-4 p-6 w-80 bg-card">
      <SidebarSearch />
      <Divider className="w-full" />
      <SidebarRequestList />
      <Divider className="w-full" />
      <FooterBar />
    </div>
  );
};
