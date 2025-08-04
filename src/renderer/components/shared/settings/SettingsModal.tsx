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
import { useEffect, useState } from 'react';
import { selectVariables, useVariableActions, useVariableStore } from '@/state/variableStore';

export const SettingsModal = () => {
  const { setVariables } = useVariableActions();
  const variables = useVariableStore((state) => selectVariables(state));
  const [editorVariables, setEditorVariables] = useState(variableMapToArray(variables));
  const [isValid, setValid] = useState(false);
  const [isOpen, setOpen] = useState(false);

  useEffect(() => {
    setEditorVariables(variableMapToArray(variables));
  }, [variables]);

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

      <DialogContent className={'max-w-4xl p-4 lg:max-w-5xl'}>
        <Tabs defaultValue="variables" className="h-[calc(50vh)]">
          <div className="-mx-4 -mt-4 flex flex-col gap-4 overflow-hidden rounded-t-lg bg-card px-4 pt-4">
            <DialogHeader className="mt-auto">
              <DialogTitle className={'font-bold'}>Collection Settings</DialogTitle>
            </DialogHeader>

            <TabsList className={'mb-4 bg-card'}>
              <TabsTrigger value="variables" className={'!font-light'}>
                Variables
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent
            value="variables"
            className="mt-4 max-h-[50vh] overflow-y-auto !rounded-none !bg-transparent"
          >
            <VariableEditor
              variables={editorVariables}
              onValidChange={setValid}
              onVariablesChange={setEditorVariables}
            />
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button
            className="mr-2"
            onClick={save}
            disabled={!isValid}
            variant={isValid ? 'default' : 'defaultDisable'}
          >
            <span className="font-bold leading-4">Save</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
