import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { FiSettings } from 'react-icons/fi';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import * as React from 'react';
import { useState } from 'react';
import {
  selectCollectionVariables,
  selectEnvironmentVariables,
  useVariableActions,
  useVariableStore,
} from '@/state/variableStore';
import { CollectionVariableTab } from '@/components/shared/settings/variableTabs/CollectionVariableTab';
import {
  variableArrayToMap,
  variableMapToArray,
} from '@/components/shared/settings/variableTabs/helper/EditVariableHelper';
import { EnvironmentVariableTab } from '@/components/shared/settings/variableTabs/EnvironmentVariableTab';

export const SettingsModal = () => {
  const actions = useVariableActions();
  const collectionStoreVariables = useVariableStore((state) => selectCollectionVariables(state));
  const environmentStoreVariables = useVariableStore((state) => selectEnvironmentVariables(state));

  const [collectionVariables, setCollectionVariables] = useState(
    variableMapToArray(collectionStoreVariables)
  );
  const [environmentVariables, setEnvironmentVariables] = useState(environmentStoreVariables);
  const [isValid, setValid] = useState(false);
  const [isOpen, setOpen] = useState(true);

  const save = async () => {
    await actions.setCollectionVariables(variableArrayToMap(collectionVariables));
    await setEnvironmentVariables(environmentVariables);
    setOpen(false);
  };

  const apply = async () => {
    await actions.setCollectionVariables(variableArrayToMap(v));
    await setEnvironmentVariables(environmentVariables);
  };

  const cancel = () => {
    setCollectionVariables(variableMapToArray(collectionStoreVariables));
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
        <Tabs defaultValue="collectionVariables" className="h-[calc(50vh)]">
          <TabsList>
            <TabsTrigger value="collectionVariables">CollectionVariables</TabsTrigger>
            <TabsTrigger value="environmentVariables">EnvironmentVariables</TabsTrigger>
          </TabsList>
          <TabsContent value="collectionVariables" className="max-h-[50vh] overflow-y-auto">
            <CollectionVariableTab
              variables={collectionVariables}
              onValidChange={setValid}
              onVariablesChange={setCollectionVariables}
            />
          </TabsContent>
          <TabsContent value="environmentVariables" className="max-h-[50vh] overflow-y-auto">
            <EnvironmentVariableTab
              environments={environmentVariables}
              onValidChange={setValid}
              onVariablesChange={setCollectionVariables} // TODO is wrong
            />
          </TabsContent>
        </Tabs>
        <DialogFooter className={'bottom-0'}>
          <Button
            className="mt-0 mr-2 mb-0"
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
