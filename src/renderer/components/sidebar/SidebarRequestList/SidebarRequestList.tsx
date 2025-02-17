import React from 'react';
import { useCollectionStore } from '@/state/collectionStore';
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarRail,
} from '@/components/ui/sidebar';
import { renderChildren } from '@/components/sidebar/SidebarRequestList/Nav/NavFolder';

export const SidebarRequestList = () => {
  const children = useCollectionStore((state) => state.collection.children);

  return (
    <div>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>{renderChildren(children)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </div>
  );
};
