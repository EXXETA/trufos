import { Folder } from 'shim/objects/folder';
import { SidebarGroup, SidebarMenuSubButton } from '@/components/ui/sidebar';
import { FolderDropdown } from '@/components/sidebar/SidebarRequestList/Nav/Dropdown/FolderDropdown';
import { selectFolder, useCollectionActions, useCollectionStore } from '@/state/collectionStore';
import { cn } from '@/lib/utils';
import { FolderIcon, SmallArrow } from '@/components/icons';
import { getIndentation } from '@/components/sidebar/SidebarRequestList/Nav/indentation';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState } from 'react';
import { InlineRename } from '@/components/shared/InlineRename';
import type { CreatingItem } from '@/components/sidebar/SidebarRequestList/types';
import { FolderDescriptionModal } from '@/components/shared/settings/FolderDescriptionModal';

interface NavFolderProps {
  folderId: Folder['id'];
  depth?: number;
  onCreateItem?: (item: CreatingItem) => void;
}

const stopPropagation = (e: React.SyntheticEvent) => e.stopPropagation();

export const NavFolder = ({ folderId, depth = 0, onCreateItem }: NavFolderProps) => {
  const { setFolderOpen, setFolderClose, renameFolder } = useCollectionActions();
  const isFolderOpen = useCollectionStore((state) => state.isFolderOpen(folderId));
  const folder = useCollectionStore((state) => selectFolder(state, folderId));
  const [isEditing, setIsEditing] = useState(false);
  const [isDescriptionOpen, setIsDescriptionOpen] = useState(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: folderId,
  });

  if (folder?.type !== 'folder') return null;

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const toggleFolder = () => {
    if (isFolderOpen) {
      setFolderClose(folderId);
    } else {
      setFolderOpen(folderId);
    }
  };

  const handleCreateItem = (item: CreatingItem) => {
    if (item) {
      setFolderOpen(folderId);
    }
    onCreateItem?.(item);
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} className="relative">
      <SidebarGroup className={cn('overflow-x-hidden p-0')}>
        <SidebarMenuSubButton
          {...listeners}
          onClick={toggleFolder}
          className={cn(
            'sidebar-request-list-item',
            'group',
            'flex',
            'items-center',
            'py-2',
            'px-5',
            'cursor-grab active:cursor-grabbing',
            'gap-1',
            'hover:[background-color:#333333]',
            getIndentation(depth)
          )}
        >
          <div
            className={cn(
              'h-6 w-6',
              'transition-transform duration-300 ease-in-out',
              isFolderOpen ? 'rotate-0' : 'rotate-270'
            )}
          >
            <SmallArrow size={24} />
          </div>

          {isEditing ? (
            <InlineRename
              initialValue={folder.title}
              onSave={(newName) => {
                const trimmed = newName.trim();
                if (trimmed && trimmed !== folder.title) {
                  renameFolder(folderId, trimmed);
                }
                setIsEditing(false);
              }}
              onCancel={() => setIsEditing(false)}
              inputClassName="h-6 text-sm"
            />
          ) : (
            <>
              <div className="flex min-w-0 flex-1 items-center gap-1">
                <FolderIcon size={16} />
                <span className="flex-1 truncate">{folder.title}</span>
              </div>

              <div
                className="sidebar-row-menu flex h-4 w-4 flex-shrink-0 items-center justify-center opacity-0 transition-opacity group-hover:opacity-100"
                onClick={stopPropagation}
                onPointerDown={stopPropagation}
              >
                <FolderDropdown
                  folder={folder}
                  onRename={() => setIsEditing(true)}
                  onEditDescription={() => setIsDescriptionOpen(true)}
                  onCreateItem={handleCreateItem}
                />
              </div>
            </>
          )}
        </SidebarMenuSubButton>
      </SidebarGroup>

      <FolderDescriptionModal
        folderId={folderId}
        isOpen={isDescriptionOpen}
        onClose={() => setIsDescriptionOpen(false)}
      />
    </div>
  );
};
