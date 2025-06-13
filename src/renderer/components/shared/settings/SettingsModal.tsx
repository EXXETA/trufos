import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { FiSettings } from 'react-icons/fi';
import {
  variableArrayToMap,
  VariableEditor,
  variableMapToArray,
} from '@/components/shared/settings/VariableTab/VariableEditor';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import * as React from 'react';
import { useState } from 'react';
import { selectVariables, useVariableActions, useVariableStore } from '@/state/variableStore';

export const SettingsModal = () => {
  const { setVariables } = useVariableActions();
  const variables = useVariableStore((state) => selectVariables(state));
  const [editorVariables, setEditorVariables] = useState(variableMapToArray(variables));
  const [isValid, setValid] = useState(false);
  const [isOpen, setOpen] = useState(false);

  const save = async () => {
    console.info('Saving variables:', editorVariables);
    await setVariables(variableArrayToMap(editorVariables));
    setOpen(false);
  };

  const cancel = () => {
    setEditorVariables(variableMapToArray(variables));
    setOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && cancel()}>
      <DialogTrigger onClick={() => setOpen(true)}>
        <FiSettings className="ml-2 text-xl" />
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
            <VariableEditor
              variables={editorVariables}
              onValidChange={setValid}
              onVariablesChange={setEditorVariables}
            />
          </TabsContent>
        </Tabs>
        <DialogFooter className="bottom-0">
          <Button
            className="mb-0 mr-2 mt-0"
            onClick={save}
            disabled={!isValid}
            variant={isValid ? 'default' : 'defaultDisable'}
          >
            <span className="font-bold leading-4">Save</span>
          </Button>
          <Button className="mb-0 mr-2 mt-0" onClick={cancel} variant="destructive">
            <span className="font-bold leading-4">Cancel</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
