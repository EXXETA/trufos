import { Divider } from '@/components/shared/Divider';
import { Button } from '@/components/ui/button';
import { AddIcon, CheckedIcon, DeleteIcon } from '@/components/icons';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useVariableStore } from '@/state/variableStore';

export const VariableTab = () => {
  const { addNewVariable, deleteVariable, update, checkDuplicate } = useVariableStore();
  const allVariables = useVariableStore((state) => state.variables);
  const allDoubleKeys = useVariableStore((state) => state.allDoubleKeys);

  return (
    <div className="p-4 relative">
      <div className="absolute top-4 right-4 left-4 z-10">
        <div className="flex">
          <Button
            className="hover:bg-transparent gap-1 h-fit"
            size="sm"
            variant="ghost"
            onClick={addNewVariable}
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
            {allVariables.map((variable, index) => (
              <TableRow key={index}>
                <TableCell className="w-1/4 break-all">
                  <input
                    type="text"
                    value={variable.key}
                    className={`w-full bg-transparent outline-none ${allDoubleKeys.includes(variable.key) ? 'text-danger' : ''}`}
                    placeholder="Enter variable key"
                    onChange={(e) => {
                      update(index, e.target.value, 'key');
                      checkDuplicate(e.target.value);
                    }}
                  />
                </TableCell>
                <TableCell className="w-1/4 break-all">
                  <input
                    type="text"
                    value={variable.value}
                    className="w-full bg-transparent outline-none"
                    placeholder="Enter variable value"
                    onChange={(e) => update(index, e.target.value, 'value')}
                  />
                </TableCell>
                <TableCell className="w-full break-all">
                  <input
                    type="text"
                    value={variable.description}
                    className="w-full bg-transparent outline-none"
                    placeholder="Enter variable description"
                    onChange={(e) => update(index, e.target.value, 'description')}
                  />
                </TableCell>
                <TableCell className="w-16 text-right">
                  <div className="flex items-center justify-center gap-2">
                    <div className="relative h-4 z-10 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={variable.isActive}
                        onChange={(e) => update(index, e.target.checked, 'isActive')}
                        className={cn(
                          'form-checkbox h-4 w-4 appearance-none border rounded-[2px]',
                          variable.isActive
                            ? 'border-[rgba(107,194,224,1)] bg-[rgba(25,54,65,1)]'
                            : 'border-[rgba(238,238,238,1)] bg-transparent'
                        )}
                      />
                      {variable.isActive && (
                        <div className="absolute left-0 top-0 h-4 w-4 flex items-center justify-center pointer-events-none rotate-6">
                          <CheckedIcon size={16} viewBox="0 0 16 16" color="rgba(107,194,224,1)" />
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="hover:bg-transparent hover:text-[rgba(107,194,224,1)] active:text-[#12B1E7] h-6 w-6"
                      onClick={() => deleteVariable(index)}
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
};
