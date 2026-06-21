import { useState, useEffect } from 'react';
import { useCollectionActions } from '@/state/collectionStore';
import { cn } from '@/lib/utils';
import { getIndentation } from '@/components/sidebar/SidebarRequestList/Nav/indentation';
import { InlineRename } from '@/components/shared/InlineRename';
import { FolderIcon } from '@/components/icons';
import { httpMethodColor } from '@/services/StyleHelper';

import { RequestMethod } from 'shim/objects/request-method';

export interface NavCreateItemProps {
  type: 'folder' | 'request';
  parentId: string;
  depth: number;
}

export const NavCreateItem = ({ type, parentId, depth }: NavCreateItemProps) => {
  const { addNewFolder, addNewRequest, setCreatingItem } = useCollectionActions();
  const [isSaving, setIsSaving] = useState(false);

  // Focus and handle save
  const handleSave = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || isSaving) return;

    setIsSaving(true);
    try {
      if (type === 'folder') {
        await addNewFolder(trimmed, parentId);
      } else {
        await addNewRequest(trimmed, parentId);
      }
      setCreatingItem(null);
    } catch (e) {
      console.error('Failed to create item', e);
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setCreatingItem(null);
  };

  return (
    <div
      className={cn(
        'sidebar-request-list-item',
        'group',
        'flex',
        'items-center',
        type === 'folder' ? 'py-2 px-5 gap-1' : 'py-2.5 gap-3 min-w-0 w-full',
        getIndentation(depth)
      )}
    >
      {type === 'folder' ? (
        <>
          <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center opacity-0" />
          <FolderIcon size={16} />
        </>
      ) : (
        <div
          className={cn(
            'flex-shrink-0 text-xs leading-3 font-normal',
            httpMethodColor(RequestMethod.GET) // Default method for new request
          )}
        >
          {RequestMethod.GET}
        </div>
      )}

      <InlineRename
        initialValue=""
        onSave={handleSave}
        onCancel={handleCancel}
        inputClassName={type === 'folder' ? 'h-6 text-sm' : 'h-6 text-xs'}
      />
    </div>
  );
};
