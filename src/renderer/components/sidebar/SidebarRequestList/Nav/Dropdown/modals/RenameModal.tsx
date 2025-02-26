import React, { useEffect, useState } from 'react';
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

export interface RenameModalProps {
  isCreate?: boolean;
  trufosObject: Folder | TrufosRequest;
  isOpen: boolean;
  setOpen: (open: boolean) => void;
}

export const RenameModal = (props: RenameModalProps) => {
  const [isValid, setValid] = useState(false);
  const [name, setName] = useState(props.trufosObject.title);
  const { renameFolder, renameRequest } = useCollectionActions();

  const save = async () => {
    if (props.trufosObject.type === 'folder') {
      renameFolder(props.trufosObject.id, name);
    } else {
      renameRequest(props.trufosObject.id, name);
    }
    props.setOpen(false);
  };

  const cancel = () => {
    props.setOpen(false);
  };

  useEffect(() => {
    setValid(name.trim().length > 0 && name !== props.trufosObject.title);
  }, [name]);

  return (
    <Dialog open={props.isOpen} onOpenChange={(open) => !open && cancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {props.trufosObject.type === 'folder'
              ? props.isCreate
                ? 'Create a new Folder'
                : 'Rename a Folder'
              : props.isCreate
                ? 'Create a new Request'
                : 'Rename a Request'}
          </DialogTitle>
        </DialogHeader>
        <div className="p-4">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-transparent outline-none"
            placeholder="Enter the folder name"
          />
        </div>
        <DialogFooter className={'bottom-0'}>
          <Button
            className="mt-0 mr-2 mb-0"
            onClick={save}
            disabled={!isValid}
            variant={isValid ? 'default' : 'defaultDisable'}
          >
            <span className="leading-4 font-bold">Save</span>
          </Button>
          <Button className="mt-0 mr-2 mb-0" onClick={cancel} variant="destructive">
            <span className="leading-4 font-bold">Cancel</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
