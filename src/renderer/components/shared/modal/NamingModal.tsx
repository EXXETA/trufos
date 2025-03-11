import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface NamingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modalTitle: string;
  onSubmit: () => Promise<void>;
  onReset: () => void;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  valid: boolean;
}

export const NamingModal = (props: NamingModalProps) => {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{props.modalTitle}</DialogTitle>
        </DialogHeader>
        <form onSubmit={props.onSubmit} onReset={props.onReset}>
          <div className="p-4">
            <input
              type="text"
              value={props.value}
              onChange={(e) => props.onChange(e.target.value)}
              className="w-full bg-transparent outline-none"
              placeholder={props.placeholder}
            />
          </div>
          <DialogFooter className="bottom-0">
            <Button disabled={!props.valid} variant={props.valid ? 'default' : 'defaultDisable'}>
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
