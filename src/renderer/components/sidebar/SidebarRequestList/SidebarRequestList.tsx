import React from 'react';
import { useCollectionStore } from '@/state/collectionStore';
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarRail,
} from '@/components/ui/sidebar';
import { NavRequest } from '@/components/sidebar/SidebarRequestList/Nav/NavRequest';
import { NavFolder } from '@/components/sidebar/SidebarRequestList/Nav/NavFolder';
import { TrufosRequest } from 'shim/objects/request';
import { Folder } from 'shim/objects/folder';

export const SidebarRequestList = () => {
  const { collection, items } = useCollectionStore();

  return (
    <div>
      <SidebarContent key={collection.id}>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu key={collection.id}>
              {(items.get(collection.id) as Folder).children.map((child) => {
                if (child.type == 'request' && items.has(child.id)) {
                  return (
                    <NavRequest key={child.id} request={items.get(child.id) as TrufosRequest} />
                  );
                } else if (child.type == 'folder' && items.has(child.id)) {
                  return <NavFolder key={child.id} folder={items.get(child.id) as Folder} />;
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
