import { Button, buttonVariants } from '@/components/ui/button';
import { AddIcon, DeleteIcon, SwapIcon } from '@/components/icons';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { Divider } from '@/components/shared/Divider';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCallback, useMemo } from 'react';
import { TrufosHeader } from 'shim/objects/headers';
import { HeaderRow } from './HeaderRow';
import { InheritedHeaderRows, InheritedHeaderRowsProps } from './InheritedHeaderRows';

export interface HeaderEditorProps {
  headers: TrufosHeader[];
  /**
   * Called with a change of the headers. It returns the changed headers without modifying the given
   * ones, so it can be applied to the latest headers, e.g. as a functional state update.
   */
  onChange: (change: (headers: TrufosHeader[]) => TrufosHeader[]) => void;
  /**
   * The headers inherited from the collection and parent folders, shown read-only before the own
   * ones. Not given for the collection, which inherits nothing.
   */
  inherited?: InheritedHeaderRowsProps;
}

/** Edits the headers of a request, a folder or the collection. */
export const HeaderEditor = ({ headers, onChange, inherited }: HeaderEditorProps) => {
  const allSelected = useMemo(
    () => headers.length > 0 && headers.every((h) => h.isActive),
    [headers]
  );

  const handleAdd = useCallback(
    () => onChange((current) => [...current, { key: '', value: '', isActive: true }]),
    [onChange]
  );

  const handleUpdate = useCallback(
    (index: number, updatedHeader: Partial<TrufosHeader>) =>
      onChange((current) =>
        current.map((header, i) => (i === index ? { ...header, ...updatedHeader } : header))
      ),
    [onChange]
  );

  const handleDelete = useCallback(
    (index: number) => onChange((current) => current.filter((_, i) => i !== index)),
    [onChange]
  );

  const handleSelectAll = useCallback(
    () => onChange((current) => current.map((header) => ({ ...header, isActive: !allSelected }))),
    [onChange, allSelected]
  );

  const handleDeleteSelected = useCallback(
    () => onChange((current) => current.filter((header) => !header.isActive)),
    [onChange]
  );

  return (
    <div>
      <div className="flex justify-between">
        <Button
          className="h-fit gap-1 hover:bg-transparent"
          size="sm"
          variant="ghost"
          onClick={handleAdd}
        >
          <AddIcon />
          Add Header
        </Button>

        <div className="flex gap-2">
          <label
            className={cn(
              buttonVariants({ variant: 'ghost', size: 'sm' }),
              'h-fit gap-2 hover:bg-transparent'
            )}
          >
            <Checkbox checked={allSelected} onCheckedChange={handleSelectAll} />
            Select All
          </label>

          <Button
            className="h-fit gap-3 hover:bg-transparent"
            size="sm"
            variant="ghost"
            onClick={handleDeleteSelected}
          >
            <DeleteIcon size={24} />
            Delete Selected
          </Button>
        </div>
      </div>

      <Divider className="mt-2" />

      <Table className="w-full table-auto">
        <TableHeader>
          <TableRow>
            <TableHead className="w-auto">
              <div className="flex items-center gap-3">
                Name
                <SwapIcon size={18} viewBox="9 7 15 18" />
              </div>
            </TableHead>
            <TableHead className="w-full">
              <div className="flex items-center gap-3">
                Value
                <SwapIcon size={18} viewBox="9 7 15 18" />
              </div>
            </TableHead>
            <TableHead className="w-16"> {/* Action Column */} </TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {inherited != null && <InheritedHeaderRows {...inherited} />}
          {headers.map((header, index) => (
            <HeaderRow
              key={index}
              index={index}
              header={header}
              handleUpdateHeader={handleUpdate}
              handleDeleteHeader={handleDelete}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
