import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { FiSettings } from 'react-icons/fi';

export const AppSettingsModal = () => {
  return (
    <Dialog>
      <DialogTrigger>
        <FiSettings className="ml-2 text-xl" />
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-bold">Settings</DialogTitle>
          <DialogDescription className={'text-(--text-secondary)'}>
            No application settings are available yet.
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
};
