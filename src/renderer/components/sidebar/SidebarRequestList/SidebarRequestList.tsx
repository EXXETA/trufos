import React from 'react';
import { useCollectionStore } from '@/state/collectionStore';
import './index.css';
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarRail,
} from '@/components/ui/sidebar';
import { NavRequest } from '@/components/sidebar/SidebarRequestList/Nav/NavRequest';
import { NavFolder } from '@/components/sidebar/SidebarRequestList/Nav/NavFolder';

export const SidebarRequestList = () => {
  const collection = useCollectionStore.getState().collection;

  console.log(collection);
  return (
    <div>
      <SidebarContent>
        <SidebarGroup>
          {/*<SidebarGroupLabel>Collection</SidebarGroupLabel>*/}
          <SidebarGroupContent>
            <SidebarMenu  key={collection.id}>
              {collection.children.map((child) => {
                if (child.type == 'request') {
                  return (
                      <NavRequest key={child.id} request={child} />
                  );
                } else if (child.type == 'folder') {
                  return (
                      <NavFolder key={child.id} folder={child} />
                  );
                }
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </div>
  );
};
