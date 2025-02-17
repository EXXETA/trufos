import { Divider } from '@/components/shared/Divider';
import { Button } from '@/components/ui/button';
import { AddIcon, DeleteIcon } from '@/components/icons';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { VARIABLE_NAME_REGEX, VariableMap, VariableObject } from 'shim/objects/variables';
import { memo, useEffect } from 'react';
import { produce } from 'immer';

export interface VariableEditorProps {
  variables: VariableObjectWithKey[];
  onValidChange?: (valid: boolean) => void;
  onVariablesChange?: (variables: VariableObjectWithKey[]) => void;
}

type VariableObjectWithKey = VariableObject & { key: string };

export function variableMapToArray(map: VariableMap) {
  return Object.entries(map).map<VariableObjectWithKey>(([key, variable]) => ({
    key,
    ...variable,
  }));
}

export function variableArrayToMap(array: VariableObjectWithKey[]) {
  return Object.fromEntries<VariableObject>(array.map(({ key, ...variable }) => [key, variable]));
}

function getInvalidVariableKeys(variables: VariableObjectWithKey[]) {
  const allKeys = new Set<string>();
  const invalidKeys = new Set<string>();
  for (const { key } of variables) {
    if (key === '' || key.length > 255 || allKeys.has(key) || !VARIABLE_NAME_REGEX.test(key)) {
      invalidKeys.add(key);
    }
    allKeys.add(key);
  }

  return invalidKeys;
}

/** A component that allows adding, editing and removing variables */
export const VariableEditor = memo<VariableEditorProps>(
  ({ variables, onValidChange, onVariablesChange }) => {
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
      <div className="p-4 relative">
        <div className="absolute top-4 right-4 left-4 z-10">
          <div className="flex">
            <Button
              className="hover:bg-transparent gap-1 h-fit"
              size="sm"
              variant="ghost"
              onClick={add}
            >
              <AddIcon /> Add Variable
            </Button>
          </div>
          <Divider className="mt-2" />
        </div>

        <div className="absolute top-16 left-4 bottom-4 right-4">
          <Table className="table-auto w-full">
            <TableHeader>
              <TableRow>
                <TableHead className="w-auto">Key</TableHead>
                <TableHead className="w-auto">Value</TableHead>
                <TableHead className="w-full">Description</TableHead>
                <TableHead className="w-16">{/* Action Column */}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {variables.map((variable, index) => (
                <TableRow key={index}>
                  <TableCell className="w-1/4 break-all">
                    <input
                      type="text"
                      value={variable.key}
                      className={`w-full bg-transparent outline-none ${invalidVariableKeys.has(variable.key) ? 'text-danger' : ''}`}
                      placeholder="Enter variable key"
                      onChange={(e) => update(index, { key: e.target.value })}
                    />
                  </TableCell>
                  <TableCell className="w-1/4 break-all">
                    <input
                      type="text"
                      value={variable.value}
                      className="w-full bg-transparent outline-none"
                      placeholder="Enter variable value"
                      onChange={(e) => update(index, { value: e.target.value })}
                    />
                  </TableCell>
                  <TableCell className="w-full break-all">
                    <input
                      type="text"
                      value={variable.description}
                      className="w-full bg-transparent outline-none"
                      placeholder="Enter variable description"
                      onChange={(e) => update(index, { description: e.target.value })}
                    />
                  </TableCell>
                  <TableCell className="w-16 text-right">
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="hover:bg-transparent hover:text-[rgba(107,194,224,1)] active:text-[#12B1E7] h-6 w-6"
                        onClick={() => remove(index)}
                      >
                        <DeleteIcon />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }
);
