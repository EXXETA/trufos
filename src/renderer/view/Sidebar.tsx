import React from 'react';
import {Divider} from '@/components/shared/Divider';
import {SidebarRequestList} from '@/components/sidebar/SidebarRequestList';
import {FooterBar} from '@/components/sidebar/FooterBar';
import {RootState} from "@/state/store";
import {useSelector} from "react-redux";

export const Sidebar = () => {
  const requests = useSelector((state: RootState) => state.requests.requests);

  return (
      <div className="flex flex-col gap-6 p-6 min-w-80 h-screen bg-card relative">
      {/*<SidebarSearch />*/}
      <Divider className="w-full" />
      <SidebarRequestList requests={requests} />
      <FooterBar className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-full max-w-sm" />
    </div>
  );
};
