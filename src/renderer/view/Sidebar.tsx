import React from 'react';
import { Divider } from '@/components/shared/Divider';
import { SidebarRequestList } from '@/components/sidebar/SidebarRequestList';
import { FooterBar } from '@/components/sidebar/FooterBar';
import { SidebarSearch } from '@/components/sidebar/SidebarSearch';
import { useRequestStore } from '@/state/requestsSlice';

export const Sidebar = () => {
  const requests = useRequestStore((state) => state.requests);

  return (
    <div className="flex-none flex flex-col gap-6 p-6 w-80 h-screen bg-card relative overflow-x-hidden ">
      <SidebarSearch />
      <Divider className="w-full" />
      <SidebarRequestList requests={requests} />
      <FooterBar />
    </div>
  );
};
