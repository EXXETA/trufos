import { useEffect, useState } from 'react';
import { TrufosRequest } from 'shim/objects/request';
import { Folder } from 'shim/objects/folder';
import { selectFolder, useCollectionActions, useCollectionStore } from '@/state/collectionStore';
import { Collection } from 'shim/objects/collection';
import { NamingModal } from '@/components/shared/modal/NamingModal';

interface RequestFolderNamingModalProps {
  createType?: 'folder' | 'request';
  trufosObject: Folder | TrufosRequest | Omit<Collection, 'variables' | 'environments'>;
  isOpen: boolean;
  setOpen: (open: boolean) => void;
}

export const RequestFolderNamingModal = ({
  createType,
  trufosObject,
  isOpen,
  setOpen,
}: RequestFolderNamingModalProps) => {
  const [isValid, setValid] = useState(false);
  const [title, setTitle] = useState(createType ? '' : trufosObject.title);
  const { renameFolder, renameRequest, addNewRequest, addNewFolder } = useCollectionActions();
  const siblingTitles: string[] = [];
  if (createType !== null && trufosObject.type !== 'request') {
    siblingTitles.push(...trufosObject.children.map((parent) => parent.title));
  } else if (trufosObject.type !== 'collection') {
    const parent = useCollectionStore((state) => selectFolder(state, trufosObject.parentId));
    if (parent) {
      siblingTitles.push(...parent.children.map((child) => child.title));
    } else {
      const collection = useCollectionStore((state) => state.collection);
      if (collection.id === trufosObject.parentId) {
        siblingTitles.push(...collection.children.map((child) => child.title));
      }
    }
  }

  const save = async () => {
    if (createType) {
      if (createType === 'folder') {
        addNewFolder(title, trufosObject.id);
      } else {
        addNewRequest(title, trufosObject.id);
      }
    } else {
      if (trufosObject.type === 'folder') {
        renameFolder(trufosObject.id, title);
      } else {
        renameRequest(trufosObject.id, title);
      }
    }
    setOpen(false);
  };

  const header = createType
    ? `Create a new ${createType.charAt(0).toUpperCase() + createType.slice(1)}`
    : `Rename the ${trufosObject.type.charAt(0).toUpperCase() + trufosObject.type.slice(1)}`;

  useEffect(() => {
    setValid(
      title.trim().length > 0 &&
        title !== (createType ? '' : trufosObject.title) &&
        siblingTitles.indexOf(title) === -1
    );
  }, [title]);

  return (
    <NamingModal
      open={isOpen}
      onOpenChange={(open) => !open && setOpen(false)}
      modalTitle={header}
      onSubmit={() => save()}
      onReset={() => setOpen(false)}
      value={title}
      onChange={(value) => setTitle(value)}
      placeholder={`Enter the ${createType ?? trufosObject.type} name`}
      valid={isValid}
    />
  );
};
