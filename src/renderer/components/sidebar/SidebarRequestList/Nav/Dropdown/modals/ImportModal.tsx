import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RendererEventService } from '@/services/event/renderer-event-service';
import { useCollectionActions } from '@/state/collectionStore';
import { CollectionType } from 'shim/objects/collection';

const SUPPORTED_IMPORT_TYPES: CollectionType[] = Object.values(CollectionType).filter(
  (type) => type !== CollectionType.Trufos
);

const eventService = RendererEventService.instance;

export interface ImportModalProps {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
}

export const ImportModal = ({ isOpen, setOpen }: ImportModalProps) => {
  const [selectedStrategy, setSelectedStrategy] = useState<CollectionType>(CollectionType.Postman);
  const [isImporting, setIsImporting] = useState(false);
  const { changeCollection } = useCollectionActions();

  const handleImport = async () => {
    try {
      setIsImporting(true);

      // Show file dialog based on strategy
      const dialogOptions =
        selectedStrategy === 'Postman'
          ? {
              properties: ['openFile' as const],
              filters: [{ name: 'Postman Collection', extensions: ['json'] }],
            }
          : {
              properties: ['openDirectory' as const],
              title: 'Select Bruno Collection Directory',
            };

      const sourceResult = await eventService.showOpenDialog(dialogOptions);

      if (sourceResult.canceled || sourceResult.filePaths.length === 0) {
        return;
      }

      const srcFilePath = sourceResult.filePaths[0];

      // For target, use the parent directory of the source
      // The backend will handle the path logic since it has access to Node.js path module
      const targetDirPath =
        selectedStrategy === 'Postman'
          ? srcFilePath.split('/').slice(0, -1).join('/') // Get parent directory for Postman JSON file
          : srcFilePath.split('/').slice(0, -1).join('/'); // Get parent directory for Bruno collection

      // Import the collection
      const collection = await eventService.importCollection(
        srcFilePath,
        targetDirPath,
        selectedStrategy
      );

      // Switch to the imported collection
      changeCollection(collection);

      setOpen(false);
    } catch (error) {
      console.error('Error importing collection:', error);
      // TODO: Show error message to user
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && setOpen(false)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import Collection</DialogTitle>
        </DialogHeader>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Import from:</label>
            <div className="space-y-2">
              {SUPPORTED_IMPORT_TYPES.map((strategy) => (
                <label key={strategy} className="flex items-center space-x-2">
                  <input
                    type="radio"
                    name="importStrategy"
                    value={strategy}
                    checked={selectedStrategy === strategy}
                    onChange={(e) => setSelectedStrategy(e.target.value as CollectionType)}
                    className="form-radio"
                  />
                  <span>{strategy}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="text-sm text-gray-600">
            {selectedStrategy === 'Postman' && (
              <p>Select a Postman collection JSON file to import.</p>
            )}
            {selectedStrategy === 'Bruno' && (
              <p>Select a Bruno collection directory (containing .bru files) to import.</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleImport} disabled={isImporting} variant="default">
            <span className="leading-4 font-bold">{isImporting ? 'Importing...' : 'Import'}</span>
          </Button>
          <Button onClick={() => setOpen(false)} variant="destructive" disabled={isImporting}>
            <span className="leading-4 font-bold">Cancel</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
