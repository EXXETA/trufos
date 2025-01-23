import React from 'react';
import { useCollectionStore } from '@/state/collectionStore';
import './index.css';
import { SidebarContent, SidebarGroup, SidebarMenu, SidebarRail } from '@/components/ui/sidebar';
import { RootFolder } from '@/components/sidebar/SidebarRequestList/Nav/RootFolder';
import { RootRequest } from '@/components/sidebar/SidebarRequestList/Nav/RootRequest';

export const SidebarRequestList = () => {
  const collection = useCollectionStore.getState().collection;

  console.log(collection);
  return (
    <div>
      <SidebarContent>
        <SidebarGroup>
          {/*<SidebarGroupLabel>Collection</SidebarGroupLabel>*/}
          <SidebarMenu>
            {collection.children.map((child) => {
              if (child.type == 'request') {
                return (
                  <div key={child.id}>
                    <RootRequest request={child} />
                  </div>
                );
              } else if (child.type == 'folder') {
                return (
                  <div key={child.id}>
                    <RootFolder folder={child} />
                  </div>
                );
              }
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </div>
  );
};
