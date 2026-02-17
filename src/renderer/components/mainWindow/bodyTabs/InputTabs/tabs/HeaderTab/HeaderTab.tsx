import { Button } from '@/components/ui/button';
import { AddIcon, DeleteIcon, SwapIcon } from '@/components/icons';
import { ActiveCheckbox } from '@/components/shared/ActiveCheckbox';
import { Divider } from '@/components/shared/Divider';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { selectRequest, useCollectionActions, useCollectionStore } from '@/state/collectionStore';
import { useCallback, useMemo } from 'react';
import { HeaderRow } from './HeaderRow';

export const HeaderTab = () => {
  const { addHeader, deleteHeader, updateHeader } = useCollectionActions();
  const headers = useCollectionStore((state) => selectRequest(state).headers);

  const allSelected = useMemo(
    () => headers.length > 0 && headers.every((h) => h.isActive),
    [headers]
  );

  const handleSelectAll = useCallback(() => {
    headers.forEach((_, index) => {
      updateHeader(index, { isActive: !allSelected });
    });
  }, [headers, allSelected, updateHeader]);

  const handleDeleteSelected = useCallback(() => {
    for (let i = headers.length - 1; i >= 0; i--) {
      if (headers[i].isActive) {
        deleteHeader(i);
      }
    }
  }, [headers, deleteHeader]);

  return (
    <div className="relative h-full p-4">
      <div className="absolute top-[16px] right-[16px] left-[16px] z-10">
        <div className="flex justify-between">
          <Button
            className="h-fit gap-1 hover:bg-transparent"
            size="sm"
            variant="ghost"
            onClick={addHeader}
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
              <ActiveCheckbox checked={allSelected} onChange={() => handleSelectAll()} />
              Select All
            </Button>

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
      </div>

      <div className="absolute top-[68px] right-[16px] bottom-[16px] left-[16px]">
        <div className="pb-4">
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
              {headers.map((header, index) => (
                <HeaderRow
                  key={index}
                  index={index}
                  header={header}
                  handleUpdateHeader={updateHeader}
                  handleDeleteHeader={deleteHeader}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};
