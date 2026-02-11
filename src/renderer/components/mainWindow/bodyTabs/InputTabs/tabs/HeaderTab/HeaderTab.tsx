import { Button } from '@/components/ui/button';
import { AddIcon, CheckedIcon, DeleteIcon } from '@/components/icons';
import { Divider } from '@/components/shared/Divider';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrufosHeader } from 'shim/objects/headers';
import { selectRequest, useCollectionActions, useCollectionStore } from '@/state/collectionStore';
import { useCallback, useMemo } from 'react';
import { HeaderRow } from './HeaderRow';
import { cn } from '@/lib/utils';

export const HeaderTab = () => {
  const { addHeader, deleteHeader, updateHeader, setDraftFlag } = useCollectionActions();
  const headers = useCollectionStore((state) => selectRequest(state).headers);

  const allSelected = useMemo(
    () => headers.length > 0 && headers.every((h) => h.isActive),
    [headers]
  );

  const handleAddHeader = useCallback(() => {
    addHeader();
    setDraftFlag();
  }, [addHeader, setDraftFlag]);

  const handleDeleteHeader = useCallback(
    (index: number) => {
      deleteHeader(index);
      setDraftFlag();
    },
    [deleteHeader, setDraftFlag]
  );

  const handleSelectAll = useCallback(() => {
    headers.forEach((_, index) => {
      updateHeader(index, { isActive: !allSelected });
    });
    setDraftFlag();
  }, [headers, allSelected, updateHeader, setDraftFlag]);

  const handleDeleteSelected = useCallback(() => {
    for (let i = headers.length - 1; i >= 0; i--) {
      if (headers[i].isActive) {
        deleteHeader(i);
      }
    }
    setDraftFlag();
  }, [headers, deleteHeader, setDraftFlag]);

  const handleUpdateHeader = useCallback(
    (index: number, updatedFields: Partial<TrufosHeader>) => {
      updateHeader(index, updatedFields);
      setDraftFlag();
    },
    [updateHeader, setDraftFlag]
  );

  return (
    <div className="relative h-full p-4">
      <div className="absolute top-[16px] right-[16px] left-[16px] z-10">
        <div className="flex justify-between">
          <Button
            className="h-fit gap-1 hover:bg-transparent"
            size="sm"
            variant="ghost"
            onClick={handleAddHeader}
          >
            <AddIcon />
            Add Header
          </Button>

          <div className="flex gap-2">
            <Button
              className="h-fit gap-2 hover:bg-transparent"
              size="sm"
              variant="ghost"
              onClick={handleSelectAll}
            >
              <div className="relative h-4 w-4 shrink-0">
                <div
                  className={cn('h-4 w-4 rounded-[2px] border', {
                    'border-accent-primary bg-accent-tertiary': allSelected,
                    'border-text-primary bg-transparent': !allSelected,
                  })}
                />
                {allSelected && (
                  <div className="pointer-events-none absolute top-0 left-0 flex h-4 w-4 rotate-6 items-center justify-center">
                    <CheckedIcon size={16} viewBox="0 0 16 16" color="var(--accent-primary)" />
                  </div>
                )}
              </div>
              Select All
            </Button>

            <Button
              className="h-fit gap-2 hover:bg-transparent"
              size="sm"
              variant="ghost"
              onClick={handleDeleteSelected}
            >
              <DeleteIcon size={20} viewBox="0 4 24 24" />
              Delete Selected
            </Button>
          </div>
        </div>

        <Divider className="mt-2" />
      </div>

      <div className="absolute top-[68px] right-[16px] bottom-[16px] left-[16px]">
        <div className="pb-4">
          <Table className="w-full table-auto">
            <TableHeader>
              <TableRow>
                <TableHead className="w-auto">Key</TableHead>
                <TableHead className="w-full">Value</TableHead>
                <TableHead className="w-16"> {/* Action Column */} </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {headers.map((header, index) => (
                <HeaderRow
                  key={index}
                  index={index}
                  header={header}
                  handleUpdateHeader={handleUpdateHeader}
                  handleDeleteHeader={handleDeleteHeader}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};