import { VariableObjectWithKey } from 'shim/objects/variables';
import { memo, useEffect } from 'react';
import { produce } from 'immer';
import { VariableButton } from '@/components/shared/settings/variableTabs/table/VariableButton';
import { VariableTable } from '@/components/shared/settings/variableTabs/table/VariableTable';
import { getInvalidVariableKeys } from '@/components/shared/settings/variableTabs/helper/EditVariableHelper';

export interface VariableEditorProps {
  variables: VariableObjectWithKey[];
  onValidChange?: (valid: boolean) => void;
  onVariablesChange?: (variables: VariableObjectWithKey[]) => void;
  className?: string;
}

/** A component that allows adding, editing and removing variables */
export const VariableEditor = memo<VariableEditorProps>(
  ({ variables, onValidChange, onVariablesChange, className }) => {
    // default props
    onValidChange ??= () => {};
    onVariablesChange ??= () => {};

    // state handling
    const invalidVariableKeys = getInvalidVariableKeys(variables);
    const isValid = invalidVariableKeys.size === 0;

    // callbacks
    useEffect(() => onValidChange(isValid), [isValid]);

    const add = () => {
      if (invalidVariableKeys.has('')) return;
      onVariablesChange(
        produce(variables, (variables) => {
          variables.push({ key: '', value: '' });
        })
      );
    };

    const update = (index: number, updatedFields: Partial<VariableObjectWithKey>) => {
      onVariablesChange(
        produce(variables, (variables) => {
          variables[index] = { ...variables[index], ...updatedFields };
        })
      );
    };

    const remove = (index: number) => {
      onVariablesChange(
        produce(variables, (variables) => {
          variables.splice(index, 1);
        })
      );
    };

    return (
      <div className={className}>
        <VariableButton add={add} />

        <VariableTable
          variables={variables}
          update={update}
          remove={remove}
          invalidVariableKeys={invalidVariableKeys}
        />
      </div>
    );
  }
);
