import * as React from 'react';
import { useEffect, useState } from 'react';
import {
  Sidebar,
  SidebarHeader,
  SidebarMenuButton,
  SidebarMenuSubButton,
  SidebarProvider,
} from '@/components/ui/sidebar';
import { EnvironmentMap } from 'shim/objects/environment';
import {
  variableArrayToMap,
  variableMapToArray,
} from '@/components/shared/settings/variableTabs/helper/EditVariableHelper';
import { VariableEditor } from '@/components/shared/settings/variableTabs/table/VariableEditor';
import { VariableObjectWithKey } from 'shim/objects/variables';
import { CreateEnvironmentModal } from '@/components/shared/settings/variableTabs/modal/CreateEnvironmentModal';
import { EnvironmentDropdown } from '@/components/shared/settings/variableTabs/dropdown/EnvironmentDropdown';

export interface EnvironmentVariableEditorProps {
  environments: EnvironmentMap;
  onValidChange?: (valid: boolean) => void;
  onEnvironmentChange?: (variables: EnvironmentMap) => void;
}

/** A component that allows adding, editing and removing variables */
export const EnvironmentVariableTab = ({
  environments,
  onEnvironmentChange,
  onValidChange,
}: EnvironmentVariableEditorProps) => {
  const environmentList = Object.keys(environments);
  const firstEnvironment = environments[environmentList[0]] ?? {};
  const [editorEnvironmentVariables, setEditorEnvironmentVariables] = useState(
    variableMapToArray(firstEnvironment)
  );
  const [selectedEnvironment, setSelectedEnvironment] = useState(environmentList[0]);

  const onVariableChange = (variables: VariableObjectWithKey[]) => {
    const variableMap = variableArrayToMap(variables);
    const updatedEnvironment = {
      ...environments,
      [selectedEnvironment]: variableMap,
    } as EnvironmentMap;
    setEditorEnvironmentVariables(variables);
    onEnvironmentChange(updatedEnvironment);
  };

  const [createModalIsOpen, setCreateModalIsOpen] = useState(false);

  useEffect(() => {
    const selectedEnvironmentVariables = environments[selectedEnvironment] ?? {};
    setEditorEnvironmentVariables(variableMapToArray(selectedEnvironmentVariables));
  }, [selectedEnvironment, environments]);

  return (
    <div className="p-4 flex h-full">
      <SidebarProvider
        style={
          {
            '--sidebar-width': '15rem',
          } as React.CSSProperties
        }
      >
        <Sidebar collapsible={'none'}>
          <SidebarHeader>Environments</SidebarHeader>
          {environmentList.map((environment) => {
            const [hover, setHover] = useState(false);

            return (
              <SidebarMenuSubButton
                onMouseMove={() => setHover(true)}
                onMouseLeave={() => setHover(false)}
                isActive={environment === selectedEnvironment}
                onClick={() => setSelectedEnvironment(environment)}
                key={environment}
              >
                {environment}
                <EnvironmentDropdown
                  environmentKey={environment}
                  hover={hover}
                  selected={environment === selectedEnvironment}
                />
              </SidebarMenuSubButton>
            );
          })}
          <SidebarMenuButton key={'newEnv'} onClick={() => setCreateModalIsOpen(true)}>
            + Add Environment
          </SidebarMenuButton>
        </Sidebar>
        <VariableEditor
          className={'p-4 m-1 flex-1'}
          variables={editorEnvironmentVariables}
          onVariablesChange={onVariableChange}
          onValidChange={onValidChange}
        />
      </SidebarProvider>
      <CreateEnvironmentModal
        isOpen={createModalIsOpen}
        setIsOpen={setCreateModalIsOpen}
        environments={environments}
        onEnvironmentChange={onEnvironmentChange}
        setSelectedEnvironment={setSelectedEnvironment}
      />
    </div>
  );
};
