import { useMemo, useState } from 'react';
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
import { useCollectionActions } from '@/state/collectionStore';
import { Collection } from 'shim/objects/collection';
import { isFolder } from 'shim/objects';

export interface NamingModalProps {
  createType?: 'folder' | 'request';
  trufosObject: Folder | TrufosRequest | Collection;
  isOpen: boolean;
  setOpen: (open: boolean) => void;
}

export const NamingModal = ({ createType, trufosObject, isOpen, setOpen }: NamingModalProps) => {
  const [name, setName] = useState(createType ? '' : trufosObject.title);
  const { renameFolder, renameRequest, addNewRequest, addNewFolder } = useCollectionActions();

  const handleSave = async () => {
    if (createType) {
      if (isFolder(trufosObject)) {
        addNewFolder(name, trufosObject.id);
      } else {
        addNewRequest(name, trufosObject.id);
      }
    } else {
      if (isFolder(trufosObject)) {
        await renameFolder(trufosObject.id, name);
      } else {
        await renameRequest(trufosObject.id, name);
      }
    }
    setOpen(false);
  };

  const title = useMemo(() => {
    return createType
      ? `Create a new ${createType.charAt(0).toUpperCase() + createType.slice(1)}`
      : `Rename the ${trufosObject.type.charAt(0).toUpperCase() + trufosObject.type.slice(1)}`;
  }, [createType, trufosObject.type]);

  const isValid = useMemo(() => {
    return name.trim().length > 0 && name !== (createType ? '' : trufosObject.title);
  }, [name, createType, trufosObject.title]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && setOpen(false)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSave} onReset={() => setOpen(false)}>
          <div className="p-4">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-transparent outline-hidden"
              placeholder={`Enter the ${createType ?? trufosObject.type} name`}
            />
          </div>
          <DialogFooter className="bottom-0">
            <Button disabled={!isValid} variant={isValid ? 'default' : 'defaultDisable'}>
              <span className="font-bold leading-4">Save</span>
            </Button>
            <Button type="reset" variant="destructive">
              <span className="font-bold leading-4">Cancel</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
