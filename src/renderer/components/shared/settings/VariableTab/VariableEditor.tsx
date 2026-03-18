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
      <div className="w-full min-w-0">
        <Button
          className="text-text-primary hover:text-text-secondary flex h-9 items-center gap-2 pl-0 hover:bg-transparent"
          size="sm"
          variant="ghost"
          onClick={add}
        >
          <AddIcon className="h-4 w-4" />
          <span className="text-[15px] font-medium">Add Variable</span>
        </Button>

        <Divider className="mb-4" />

        <div className="border-border bg-background mt-1 overflow-hidden rounded-xl border">
          <Table className="w-full table-auto border-collapse">
            <TableHeader className="[&_tr]:border-0">
              <TableRow className="hover:bg-background">
                <TableHead className="text-text-primary w-1/5 border-r border-b py-3 text-[14px] font-medium">
                  Key
                </TableHead>
                <TableHead className="text-text-primary w-1/4 border-r border-b text-[14px] font-medium">
                  Value
                </TableHead>
                <TableHead className="text-text-primary w-auto border-r border-b text-[14px] font-medium">
                  Description
                </TableHead>
                <TableHead className="text-text-primary w-24 border-r border-b text-center text-[14px] font-medium">
                  Secret
                </TableHead>
                <TableHead className="w-14 border-b">{/* Action Column */}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {variables.map((variable, index) => (
                <TableRow
                  key={index}
                  className="hover:bg-background-secondary border-b transition-colors last:border-0"
                >
                  <TableCell className="border-r px-4">
                    <input
                      type="text"
                      value={variable.key}
                      className={cn(
                        'placeholder:text-text-secondary text-text-primary w-full bg-transparent py-3 text-[14px] outline-none',
                        invalidVariableKeys.has(variable.key) && 'text-destructive'
                      )}
                      placeholder="Enter variable key"
                      onChange={(e) => update(index, { key: e.target.value })}
                    />
                  </TableCell>
                  <TableCell className="border-r px-4">
                    <SecretInput
                      secret={variable.secret}
                      value={variable.value}
                      className="placeholder:text-text-secondary text-text-primary w-full border-none bg-transparent py-3 text-[14px] outline-none"
                      placeholder="Enter variable value"
                      onChange={(e) => update(index, { value: e.target.value })}
                    />
                  </TableCell>
                  <TableCell className="border-r px-4">
                    <input
                      type="text"
                      value={variable.description}
                      className="text-text-primary placeholder:text-text-secondary w-full bg-transparent py-3 text-[14px] outline-none"
                      placeholder="Enter variable description"
                      onChange={(e) => update(index, { description: e.target.value })}
                    />
                  </TableCell>
                  <TableCell className="border-r py-3 text-center">
                    <Checkbox
                      className="border-text-secondary hover:border-text-primary data-[state=checked]:border-text-secondary data-[state=checked]:bg-text-secondary cursor-pointer transition-colors"
                      checked={variable.secret}
                      onCheckedChange={(checked) => update(index, { secret: Boolean(checked) })}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-text-secondary hover:text-destructive transition-colors hover:bg-transparent"
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
      </div>
    );
  }
);
