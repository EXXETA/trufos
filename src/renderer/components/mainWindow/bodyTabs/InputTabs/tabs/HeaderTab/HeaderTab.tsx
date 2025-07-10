import { Button } from '@/components/ui/button';
import { AddIcon, DeleteIcon } from '@/components/icons';
import { Divider } from '@/components/shared/Divider';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrufosHeader } from 'shim/objects/headers';
import { selectRequest, useCollectionActions, useCollectionStore } from '@/state/collectionStore';
import { useCallback } from 'react';
import { HeaderRow } from './HeaderRow';

export const HeaderTab = () => {
  const { addHeader, deleteHeader, clearHeaders, updateHeader, setDraftFlag } =
    useCollectionActions();
  const headers = useCollectionStore((state) => selectRequest(state).headers);

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

  const handleDeleteAllHeaders = useCallback(() => {
    clearHeaders();
    setDraftFlag();
  }, [clearHeaders, setDraftFlag]);

  const handleUpdateHeader = useCallback(
    (index: number, updatedFields: Partial<TrufosHeader>) => {
      updateHeader(index, updatedFields);
      setDraftFlag();
    },
    [updateHeader, setDraftFlag]
  );

  return (
    <div className="relative h-full p-4">
      <div className="absolute left-[16px] right-[16px] top-[16px] z-10">
        <div className="flex">
          <Button
            className="h-fit gap-1 hover:bg-transparent"
            size={'sm'}
            variant={'ghost'}
            onClick={handleAddHeader}
          >
            <AddIcon />
            Add Header
          </Button>
          <Button
            className="h-fit gap-1 hover:bg-transparent"
            size={'sm'}
            variant={'ghost'}
            onClick={handleDeleteAllHeaders}
          >
            <DeleteIcon />
            Delete All
          </Button>
        </div>

        <Divider className="mt-2" />
      </div>

      <div className="absolute bottom-[16px] left-[16px] right-[16px] top-[68px]">
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
