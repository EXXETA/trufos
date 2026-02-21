import { Divider } from '@/components/shared/Divider';
import { Button } from '@/components/ui/button';
import { AddIcon } from '@/components/icons';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { VARIABLE_NAME_REGEX, VariableObjectWithKey } from 'shim/objects/variables';
import { memo, useEffect } from 'react';
import { produce } from 'immer';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2 } from 'lucide-react';
import { SecretInput } from '@/components/ui/secret-input';
import { cn } from '@/lib/utils';

export interface VariableEditorProps {
  variables: VariableObjectWithKey[];
  onValidChange?: (valid: boolean) => void;
  onVariablesChange?: (variables: VariableObjectWithKey[]) => void;
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
          variables.push({ key: '', value: '', description: '', secret: false });
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
      <>
        <Button
          className="mx-6 flex h-9 items-center gap-2 text-[#e8e8e8] hover:bg-transparent hover:text-white"
          size="sm"
          variant="ghost"
          onClick={add}
        >
          <AddIcon className="h-4 w-4" />
          <span className="text-[15px] font-medium">Add Variable</span>
        </Button>

        <div className="mx-6 mt-1 border-b border-[#2a2a2a]" />

        <div className="mx-6 mt-4 overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#111111]">
          <Table className="w-full table-auto border-separate border-spacing-0 border-none">
            <TableHeader className="bg-[#161616] [&_tr]:border-0">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-1/5 rounded-tl-xl border-r border-b border-[#2a2a2a] py-3 text-[14px] font-medium text-[#ffffff]">
                  Key
                </TableHead>
                <TableHead className="w-1/4 border-r border-b border-[#2a2a2a] text-[14px] font-medium text-[#ffffff]">
                  Value
                </TableHead>
                <TableHead className="w-auto border-r border-b border-[#2a2a2a] text-[14px] font-medium text-[#ffffff]">
                  Description
                </TableHead>
                <TableHead className="w-24 border-r border-b border-[#2a2a2a] text-center text-[14px] font-medium text-[#ffffff]">
                  Secret
                </TableHead>
                <TableHead className="w-14 rounded-tr-xl border-b border-[#2a2a2a]">
                  {/* Action Column */}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {variables.map((variable, index) => (
                <TableRow
                  key={index}
                  className="border-b border-[#2a2a2a] transition-colors last:border-0 hover:bg-[#1a1a1a]"
                >
                  <TableCell className="border-r border-[#2a2a2a] px-4 py-3">
                    <input
                      type="text"
                      value={variable.key}
                      className={cn(
                        'w-full bg-transparent text-[14px] text-[#e8e8e8] outline-none placeholder:text-[#9a9a9a]',
                        invalidVariableKeys.has(variable.key) && 'text-red-500'
                      )}
                      placeholder="Enter variable key"
                      onChange={(e) => update(index, { key: e.target.value })}
                    />
                  </TableCell>
                  <TableCell className="border-r border-[#2a2a2a] px-4">
                    <SecretInput
                      secret={variable.secret}
                      value={variable.value}
                      className="w-full border-none bg-transparent text-[14px] text-[#e8e8e8] outline-none placeholder:text-[#9a9a9a]"
                      placeholder="Enter variable value"
                      onChange={(e) => update(index, { value: e.target.value })}
                    />
                  </TableCell>
                  <TableCell className="border-r border-[#2a2a2a] px-4">
                    <input
                      type="text"
                      value={variable.description}
                      className="w-full bg-transparent text-[14px] text-[#a8a8a8] outline-none placeholder:text-[#9a9a9a]"
                      placeholder="Enter variable description"
                      onChange={(e) => update(index, { description: e.target.value })}
                    />
                  </TableCell>
                  <TableCell className="border-r border-[#2a2a2a] text-center">
                    <Checkbox
                      className="cursor-pointer border-[#6a6a6a] transition-colors hover:border-white data-[state=checked]:border-white data-[state=checked]:bg-white"
                      checked={variable.secret}
                      onCheckedChange={(checked) => update(index, { secret: Boolean(checked) })}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-[#cfcfcf] transition-colors hover:bg-transparent hover:text-[#ff6b6b]"
                      onClick={() => remove(index)}
                    >
                      <Trash2 size={18} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </>
    );
  }
);
