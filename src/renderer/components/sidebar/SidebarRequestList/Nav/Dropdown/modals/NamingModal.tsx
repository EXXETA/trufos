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
import { isFolder, isRequest } from 'shim/objects';

export interface NamingModalProps {
  createType?: 'folder' | 'request';
  trufosObject: Folder | TrufosRequest | Collection;
  onClose: VoidFunction;
}

export const NamingModal = ({ createType, trufosObject, onClose }: NamingModalProps) => {
  const [name, setName] = useState(createType ? '' : trufosObject?.title);
  const { renameFolder, renameRequest, addNewRequest, addNewFolder } = useCollectionActions();

  const handleSave = () => {
    onClose();
    if (createType) {
      if (createType === 'folder') {
        addNewFolder(name, trufosObject.id);
      } else if (createType === 'request') {
        addNewRequest(name, trufosObject.id);
      }
    } else {
      if (isFolder(trufosObject)) {
        renameFolder(trufosObject.id, name);
      } else if (isRequest(trufosObject)) {
        renameRequest(trufosObject.id, name);
      }
    }
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
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSave} onReset={() => onClose()}>
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
