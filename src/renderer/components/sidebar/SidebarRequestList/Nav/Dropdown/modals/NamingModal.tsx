import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TrufosRequest } from 'shim/objects/request';
import { Folder } from 'shim/objects/folder';
import { Button } from '@/components/ui/button';
import { useCollectionActions, useCollectionStore, selectFolder } from '@/state/collectionStore';
import { Collection } from 'shim/objects/collection';

export interface NamingModalProps {
  createType?: 'folder' | 'request';
  trufosObject: Folder | TrufosRequest | Collection;
  isOpen: boolean;
  setOpen: (open: boolean) => void;
}

export const NamingModal = ({ createType, trufosObject, isOpen, setOpen }: NamingModalProps) => {
  const [isValid, setValid] = useState(false);
  const [name, setName] = useState(createType ? '' : trufosObject.title);
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
        addNewFolder(name, trufosObject.id);
      } else {
        addNewRequest(name, trufosObject.id);
      }
    } else {
      if (trufosObject.type === 'folder') {
        renameFolder(trufosObject.id, name);
      } else {
        renameRequest(trufosObject.id, name);
      }
    }
    setOpen(false);
  };

  const title = createType
    ? `Create a new ${createType.charAt(0).toUpperCase() + createType.slice(1)}`
    : `Rename the ${trufosObject.type.charAt(0).toUpperCase() + trufosObject.type.slice(1)}`;

  useEffect(() => {
    setValid(
      name.trim().length > 0 &&
        name !== (createType ? '' : trufosObject.title) &&
        siblingTitles.indexOf(name) === -1
    );
  }, [name]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && setOpen(false)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={() => save()} onReset={() => setOpen(false)}>
          <div className="p-4">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-transparent outline-none"
              placeholder={`Enter the ${createType ?? trufosObject.type} name`}
            />
          </div>
          <DialogFooter className="bottom-0">
            <Button disabled={!isValid} variant={isValid ? 'default' : 'defaultDisable'}>
              <span className="leading-4 font-bold">Save</span>
            </Button>
            <Button type="reset" variant="destructive">
              <span className="leading-4 font-bold">Cancel</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
