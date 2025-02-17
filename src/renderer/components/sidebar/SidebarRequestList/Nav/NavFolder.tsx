import { Folder } from 'shim/objects/folder';
import { NavRequest } from '@/components/sidebar/SidebarRequestList/Nav/NavRequest';
import React from 'react';
import { SidebarMenuSub, SidebarMenuSubButton } from '@/components/ui/sidebar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { FaRegFolderClosed, FaRegFolderOpen } from 'react-icons/fa6';
import { FolderDropdown } from '@/components/sidebar/SidebarRequestList/Nav/Dropdown/FolderDropdown';
import { selectFolder, useCollectionActions, useCollectionStore } from '@/state/collectionStore';
import { TrufosRequest } from 'shim/objects/request';

interface NavFolderProps {
  folderId: Folder['id'];
}

/**
 * Render the children of a folder or collection
 * @param children The children to render
 */
export function renderChildren(children: (TrufosRequest | Folder)[]) {
  return children.map((child) => {
    if (child.type === 'request') {
      return <NavRequest key={child.id} requestId={child.id} />;
    } else if (child.type === 'folder') {
      return <NavFolder key={child.id} folderId={child.id} />;
    }
  });
}

export const NavFolder = ({ folderId }: NavFolderProps) => {
  const { setFolderOpen, setFolderClose } = useCollectionActions();
  const isFolderOpen = useCollectionStore((state) => state.openFolders.has(folderId));
  const { type, title } = useCollectionStore((state) => selectFolder(state, folderId));
  const children = useCollectionStore((state) => selectFolder(state, folderId).children);
  if (type !== 'folder') return null;

  return (
    <Collapsible
      asChild
      open={isFolderOpen}
      onOpenChange={(open) => (open ? setFolderOpen(folderId) : setFolderClose(folderId))}
      className="group/collapsible"
    >
      <SidebarMenuSub>
        <CollapsibleTrigger asChild>
          <SidebarMenuSubButton>
            {isFolderOpen ? <FaRegFolderOpen /> : <FaRegFolderClosed />}
            <span>{title}</span>
            <FolderDropdown folderId={folderId} />
          </SidebarMenuSubButton>
        </CollapsibleTrigger>
        <CollapsibleContent>{renderChildren(children)}</CollapsibleContent>
      </SidebarMenuSub>
    </Collapsible>
  );
};
