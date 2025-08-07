import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export interface EnvironmentNamingModalProps {
  isOpen: boolean;
  environmentName: string;
  onSave: (newName: string) => void;
  onClose: () => void;
}

export const EnvironmentNamingModal = ({
  isOpen,
  environmentName,
  onSave,
  onClose,
}: EnvironmentNamingModalProps) => {
  const [name, setName] = useState(environmentName);

  const handleSave = () => {
    if (name.trim() && name !== environmentName) {
      onSave(name.trim());
    }
  };

  const isValid = name.trim().length > 0 && name.trim() !== environmentName;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename Environment</DialogTitle>
        </DialogHeader>

        <div className="p-4">
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter environment name"
            onKeyDown={(e) => e.key === 'Enter' && isValid && handleSave()}
          />
        </div>

        <DialogFooter>
          <Button onClick={onClose} variant="outline">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!isValid}
            variant={isValid ? 'default' : 'defaultDisable'}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
