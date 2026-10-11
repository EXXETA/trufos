import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AppGeneralTab } from '@/components/shared/settings/AppGeneralTab/AppGeneralTab';
import { HistoryTab } from '@/components/shared/settings/HistoryTab/HistoryTab';

export interface AppSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AppSettingsModal = ({ isOpen, onClose }: AppSettingsModalProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex h-[80vh] max-w-4xl flex-col p-0 lg:max-w-5xl">
        <div className="flex h-full flex-col overflow-hidden rounded-lg">
          <div className="bg-background-secondary shrink-0 px-4 pt-4">
            <DialogHeader>
              <DialogTitle className="font-bold">Settings</DialogTitle>
            </DialogHeader>
          </div>

          <Tabs
            defaultValue="general"
            className="bg-background-primary flex min-h-0 flex-1 flex-col rounded-none"
          >
            <div className="bg-background-secondary shrink-0 px-4 py-4">
              <TabsList className="bg-transparent">
                <TabsTrigger value="general" className="px-4 py-2.5 font-light!">
                  General
                </TabsTrigger>
                <TabsTrigger value="history" className="px-4 py-2.5 font-light!">
                  History
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent
              value="general"
              className="bg-background-primary m-0 min-h-0 flex-1 overflow-y-auto rounded-none p-0"
            >
              <AppGeneralTab />
            </TabsContent>

            <TabsContent
              value="history"
              className="bg-background-primary m-0 min-h-0 flex-1 overflow-hidden rounded-none p-0"
            >
              <HistoryTab />
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};
