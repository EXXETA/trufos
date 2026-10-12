import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RendererEventService } from '@/services/event/renderer-event-service';
import { flushModelEdits } from '@/lib/monaco/models';
import { Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { FilePicker } from '@/components/ui/file-picker';
import { DroppedEntryInfo } from '@/components/ui/file-drop-zone';
import { FolderPlusIcon } from '@/components/icons';
import { showError } from '@/error/errorHandler';

const eventService = RendererEventService.instance;

interface TitleInputProps {
  value: string;
  onChange: (value: string) => void;
}

const TitleInput: React.FC<TitleInputProps> = ({ value, onChange }) => {
  return (
    <div className="flex flex-col gap-2">
      <Input
        className="rounded-lg"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="My new Collection"
      />
    </div>
  );
};

export const CollectionCreate: React.FC<{
  onClose?: () => void;
  open?: boolean;
  loadCollections: () => void;
}> = ({ onClose, open = true, loadCollections }) => {
  const [targetEntry, setTargetEntry] = useState<DroppedEntryInfo>();
  const [title, setTitle] = useState<string>('');

  const isCreationDisabled = !title || !targetEntry?.path;

  const createCollection = async () => {
    try {
      console.info('Creating collection at', targetEntry!.path);
      // the new collection is opened, so the editor changes must reach the current one first
      await flushModelEdits();
      await eventService.createCollection(targetEntry!.path, title);

      await loadCollections();
    } catch (e) {
      showError('Could not create the collection', e);
    } finally {
      onClose?.();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose?.()}>
      <DialogContent className="flex max-h-[80vh] w-190 max-w-3xl flex-col border-none shadow-none">
        <DialogHeader>
          <DialogTitle>New Collection</DialogTitle>
        </DialogHeader>

        <FilePicker
          title="Select directory for new collection"
          description="This is where the imported collection will be placed"
          entry={targetEntry}
          icon={<FolderPlusIcon size={36} />}
          onFileSelected={setTargetEntry}
          onFileRemoved={() => setTargetEntry(undefined)}
          directoryMode
          controlled
        />

        <TitleInput value={title} onChange={setTitle} />

        <DialogFooter className="mt-2 justify-center gap-2 sm:justify-center">
          <div className="flex w-full justify-center">
            <Button
              onClick={createCollection}
              disabled={isCreationDisabled}
              className="pointer gap-2"
            >
              <Plus size={16} /> {'Create Collection'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
