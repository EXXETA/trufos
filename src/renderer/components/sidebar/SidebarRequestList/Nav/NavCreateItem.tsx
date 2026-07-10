import { useState } from 'react';
import { useCollectionActions } from '@/state/appStore';
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
  onCancel: () => void;
}

export const NavCreateItem = ({ type, parentId, depth, onCancel }: NavCreateItemProps) => {
  const { addNewFolder, addNewRequest } = useCollectionActions();
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
      onCancel();
    } catch (e) {
      console.error('Failed to create item', e);
      setIsSaving(false);
    }
  };

  return (
    <div
      className={cn(
        'sidebar-request-list-item',
        'group',
        'flex',
        'items-center',
        type === 'folder' ? 'gap-1 px-5 py-2' : 'w-full min-w-0 gap-3 py-2.5',
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
        onCancel={onCancel}
        inputClassName={type === 'folder' ? 'h-6 text-sm' : 'h-6 text-xs'}
      />
    </div>
  );
};
