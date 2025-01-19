import React from 'react';
import { useCollectionStore } from '@/state/collectionStore';
import './index.css';
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarRail,
} from '@/components/ui/sidebar';
import { RootFolder } from '@/components/sidebar/SidebarRequestList/Nav/RootFolder';
import { NavRequest } from '@/components/sidebar/SidebarRequestList/Nav/NavRequest';

export const SidebarRequestList = () => {
  const collection = useCollectionStore.getState().collection;

  console.log(collection);
  return (
    <div>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Collection</SidebarGroupLabel>
          <SidebarMenu>
            {collection.children.map((child) => {
              if (child.type == 'request') {
                return <NavRequest request={child}></NavRequest>;
              } else if (child.type == 'folder') {
                return <RootFolder folder={child}></RootFolder>;
              }
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </div>
  );
};
