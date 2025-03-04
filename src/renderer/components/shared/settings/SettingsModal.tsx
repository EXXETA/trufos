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
  CollectionVariableEditor,
  variableMapToArray,
} from '@/components/shared/settings/VariableTab/CollectionVariableEditor';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import * as React from 'react';
import { useState } from 'react';
import { selectVariables, useVariableActions, useVariableStore } from '@/state/variableStore';
import { EnvironmentVariableEditor } from '@/components/shared/settings/VariableTab/EnvironmentVariableEditor';

export const SettingsModal = () => {
  const { setVariables } = useVariableActions();
  const variables = useVariableStore((state) => selectVariables(state));
  const [editorVariables, setEditorVariables] = useState(variableMapToArray(variables));
  const [isValid, setValid] = useState(false);
  const [isOpen, setOpen] = useState(true); //TODO change to false

  const save = async () => {
    apply();
    setOpen(false);
  };

  const apply = async () => {
    await setVariables(variableArrayToMap(editorVariables));
  };

  const cancel = () => {
    setEditorVariables(variableMapToArray(variables));
    setOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && cancel()}>
      <DialogTrigger onClick={() => setOpen(true)}>
        <FiSettings className="text-xl ml-2" />
      </DialogTrigger>
      <DialogContent style={{ minWidth: '100vh' }}>
        <DialogHeader className="mt-auto">
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="collection" className="h-[calc(50vh)]">
          <TabsList>
            <TabsTrigger value="collection">Collection Variables</TabsTrigger>
            <TabsTrigger value="environment">Environment Variables</TabsTrigger>
          </TabsList>
          <TabsContent value="collection" className="max-h-[50vh] overflow-y-auto">
            <CollectionVariableEditor
              variables={editorVariables}
              onValidChange={setValid}
              onVariablesChange={setEditorVariables}
            />
          </TabsContent>
          <TabsContent value="environment" className="max-h-[50vh] overflow-y-auto">
            <EnvironmentVariableEditor
              variables={editorVariables}
              onValidChange={setValid}
              onVariablesChange={setEditorVariables}
            ></EnvironmentVariableEditor>
          </TabsContent>
        </Tabs>
        <DialogFooter className={'bottom-0'}>
          <Button
            className="mt-0 mr-0 mb-0"
            onClick={save}
            disabled={!isValid}
            variant={isValid ? 'default' : 'defaultDisable'}
          >
            <span className="leading-4 font-bold">Save</span>
          </Button>
          <Button
            className="mt-0 ml-0 mr-0 mb-0"
            onClick={apply}
            disabled={!isValid}
            variant={isValid ? 'secondary' : 'secondaryDisable'}
          >
            <span className="leading-4 font-bold">Apply</span>
          </Button>
          <Button className="mt-0 mr-2 mb-0" onClick={cancel} variant="destructive">
            <span className="leading-4 font-bold">Cancel</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
