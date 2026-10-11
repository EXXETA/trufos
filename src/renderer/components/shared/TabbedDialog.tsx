import type { ReactNode } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export interface DialogTab {
  value: string;
  label: string;
  content: ReactNode;
}

export interface TabbedDialogProps {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  /** The tabs, of which the first one is shown when the dialog opens. */
  tabs: DialogTab[];
  /** Shown below the content of the active tab, e.g. buttons to save or cancel. */
  footer?: ReactNode;
}

/** A large dialog with a fixed header and tabs, e.g. for settings. */
export const TabbedDialog = ({ title, isOpen, onClose, tabs, footer }: TabbedDialogProps) => (
  <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
    <DialogContent size="large">
      <div className="flex h-full flex-col overflow-hidden rounded-lg">
        <div className="bg-background-secondary shrink-0 px-4 pt-4">
          <DialogHeader>
            <DialogTitle className="font-bold">{title}</DialogTitle>
          </DialogHeader>
        </div>

        <Tabs
          defaultValue={tabs[0]?.value}
          className="bg-background-primary flex min-h-0 flex-1 flex-col rounded-none"
        >
          <div className="bg-background-secondary shrink-0 px-4 py-4">
            <TabsList className="bg-transparent">
              {tabs.map(({ value, label }) => (
                <TabsTrigger key={value} value={value} className="px-4 py-2.5 font-light!">
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {tabs.map(({ value, content }) => (
            <TabsContent
              key={value}
              value={value}
              className="bg-background-primary m-0 min-h-0 flex-1 overflow-y-auto rounded-none p-0"
            >
              {content}
            </TabsContent>
          ))}

          {footer != null && <div className="flex shrink-0 justify-end gap-2 p-4">{footer}</div>}
        </Tabs>
      </div>
    </DialogContent>
  </Dialog>
);
