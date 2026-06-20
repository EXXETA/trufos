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

export interface NamingModalProps {
  createType: 'folder' | 'request';
  trufosObject: Folder | TrufosRequest | Collection;
  onClose: VoidFunction;
}

export const NamingModal = ({ createType, trufosObject, onClose }: NamingModalProps) => {
  const [name, setName] = useState('');
  const { addNewRequest, addNewFolder } = useCollectionActions();

  const handleSave = () => {
    onClose();
    if (createType === 'folder') {
      addNewFolder(name, trufosObject.id);
    } else if (createType === 'request') {
      addNewRequest(name, trufosObject.id);
    }
  };

  const title = useMemo(() => {
    return `Create a new ${createType.charAt(0).toUpperCase() + createType.slice(1)}`;
  }, [createType]);

  const isValid = useMemo(() => {
    return name.trim().length > 0;
  }, [name]);

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
              placeholder={`Enter the ${createType} name`}
            />
          </div>
          <DialogFooter className="bottom-0">
            <Button disabled={!isValid}>
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
