import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { DeleteIcon } from '@/components/icons';
import { VariableObjectWithKey } from 'shim/objects/variables';
import { cn } from '@/lib/utils';

interface VariableTableProps {
  variables: VariableObjectWithKey[];
  update: (index: number, updatedFields: Partial<VariableObjectWithKey>) => void;
  remove: (index: number) => void;
  invalidVariableKeys: Set<string>;
  className?: string;
}

export const VariableTable = ({
  variables,
  update,
  remove,
  invalidVariableKeys,
  className,
}: VariableTableProps) => {
  return (
    <div className={cn('top-16 left-4 bottom-4 right-4', className)}>
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
  );
};
