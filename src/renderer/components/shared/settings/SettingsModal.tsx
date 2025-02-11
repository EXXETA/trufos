import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { FiSettings } from 'react-icons/fi';
import { VariableEditor } from '@/components/shared/settings/VariableEditor/VariableEditor';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import * as React from 'react';
import { useCallback, useRef, useState } from 'react';
import { useCollectionActions, useCollectionStore } from '@/state/collectionStore';

export const SettingsModal = () => {
  const variableEditorRef = useRef<VariableEditor>();
  const [isOpen, setOpen] = useState(false);
  const { setVariables } = useCollectionActions();

  const variables = useCollectionStore((state) => state.collection.variables);
  const save = useCallback(() => {
    if (variableEditorRef.current == null) return;
    setVariables(variableEditorRef.current.getVariables());
    setOpen(false);
  }, [setVariables, setOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogTrigger onClick={() => setOpen(true)}>
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
            <VariableEditor initialVariables={variables} ref={variableEditorRef} />
          </TabsContent>
        </Tabs>
        <DialogFooter className="bottom-0">
          <Button className="mt-0 mr-2 mb-0" onClick={save}>
            <span className="leading-4 font-bold">Save</span>
          </Button>
          <Button className="mt-0 mr-2 mb-0" onClick={() => setOpen(false)} variant="destructive">
            <span className="leading-4 font-bold">Cancel</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
