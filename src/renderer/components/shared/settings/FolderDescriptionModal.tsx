import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MarkdownPreview } from '@/components/shared/MarkdownPreview';
import { selectFolder, useCollectionActions, useCollectionStore } from '@/state/collectionStore';

export interface FolderDescriptionModalProps {
  folderId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function FolderDescriptionModal({ folderId, isOpen, onClose }: FolderDescriptionModalProps) {
  const folder = useCollectionStore((state) => selectFolder(state, folderId));
  const { updateFolder } = useCollectionActions();
  const [description, setDescription] = useState(folder?.description ?? '');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) setDescription(folder?.description ?? '');
  }, [isOpen, folder?.description]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateFolder(folderId, {
        description: description.trim() === '' ? undefined : description,
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-w-2xl flex-col">
        <DialogHeader>
          <DialogTitle>Folder Description</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe this folder..."
          />
          {description.trim().length > 0 ? (
            <div className="bg-muted/10 border-border max-h-40 overflow-y-auto rounded border p-3 text-sm">
              <MarkdownPreview content={description} />
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
