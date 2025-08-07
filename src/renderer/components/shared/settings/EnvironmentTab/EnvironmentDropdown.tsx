import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreHorizontal } from 'lucide-react';
import { useState } from 'react';
import { EnvironmentNamingModal } from './EnvironmentNamingModal';

export interface EnvironmentDropdownProps {
  environmentKey: string;
  onRename: (oldKey: string, newKey: string) => void;
  onCopy: (key: string) => void;
  onDelete: (key: string) => void;
}

export const EnvironmentDropdown = ({
  environmentKey,
  onRename,
  onCopy,
  onDelete,
}: EnvironmentDropdownProps) => {
  const [renameModalIsOpen, setRenameModalIsOpen] = useState(false);

  const handleRename = (newName: string) => {
    onRename(environmentKey, newName);
    setRenameModalIsOpen(false);
  };

  return (
    <div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">More</span>
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent className="w-48 rounded-lg" side="right" align="start">
          <DropdownMenuItem onClick={() => setRenameModalIsOpen(true)}>
            Rename Environment
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => onCopy(environmentKey)}>
            Copy Environment
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => onDelete(environmentKey)} className="text-destructive">
            Delete Environment
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {renameModalIsOpen && (
        <EnvironmentNamingModal
          isOpen={renameModalIsOpen}
          environmentName={environmentKey}
          onSave={handleRename}
          onClose={() => setRenameModalIsOpen(false)}
        />
      )}
    </div>
  );
};
