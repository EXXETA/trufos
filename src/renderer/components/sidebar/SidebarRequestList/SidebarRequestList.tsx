import { useCollectionStore } from '@/state/collectionStore';
import { SidebarContent, SidebarMenu } from '@/components/ui/sidebar';
import { NavFolder } from '@/components/sidebar/SidebarRequestList/Nav/NavFolder';
import { TrufosRequest } from 'shim/objects/request';
import { Folder } from 'shim/objects/folder';
import { NavRequest } from '@/components/sidebar/SidebarRequestList/Nav/NavRequest';

/**
 * Render the children of a folder or collection
 * @param children The children to render
 */
export function renderChildren(children: (TrufosRequest | Folder)[], depth = 0) {
  return children.map((child) => {
    if (child.type === 'request') {
      return <NavRequest key={child.id} requestId={child.id} depth={depth + 1} />;
    } else if (child.type === 'folder') {
      return <NavFolder key={child.id} folderId={child.id} depth={depth + 1} />;
    }
    return null;
  });
}

export const SidebarRequestList = () => {
  const children = useCollectionStore((state) => state.collection.children);

  return (
    <SidebarContent className={'tabs-scrollbar -ml-6 -mr-6 flex-1 overflow-y-auto'}>
      <SidebarMenu className="gap-0">{renderChildren(children)}</SidebarMenu>
    </SidebarContent>
  );
};
