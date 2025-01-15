import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { FiSettings } from 'react-icons/fi';
import { VariableTab } from '@/components/shared/settings/VariableTab/VariableTab';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useVariableStore } from '@/state/variableStore';
import { Button } from '@/components/ui/button';
import * as React from 'react';

interface Props {
  className: string;
}
export const SettingsModal = (props: Props) => {
  const { className } = props;
  const { save, cancel, openModal } = useVariableStore.getState();
  const isOpen = useVariableStore((state) => state.isOpen);
  const allDoubleKeys = useVariableStore((state) => state.allDoubleKeys);

  return (
    <Dialog open={isOpen} onOpenChange={cancel}>
      <DialogTrigger className={className} onClick={openModal}>
        <FiSettings className="text-xl ml-2" />
      </DialogTrigger>
      <DialogContent style={{ minWidth: '100vh' }}>
        <DialogHeader className="mt-auto">
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="variables" className="h-[calc(50vh)]">
          <TabsList>
            <TabsTrigger value="variables">Variables</TabsTrigger>
          </TabsList>
          <TabsContent value="variables" className="max-h-[50vh] overflow-y-auto">
            <VariableTab />
          </TabsContent>
        </Tabs>
        <DialogFooter className={'bottom-0'}>
          <Button
            disabled={allDoubleKeys.length !== 0}
            className="mt-0 mr-2 mb-0"
            onClick={save}
            variant={allDoubleKeys.length === 0 ? 'default' : 'defaultDisable'}
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
