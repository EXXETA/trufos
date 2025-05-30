import { Button } from '@/components/ui/button';
import { AddIcon, CheckedIcon, DeleteIcon } from '@/components/icons';
import { Divider } from '@/components/shared/Divider';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { TrufosHeader } from 'shim/objects/headers';
import { selectRequest, useCollectionActions, useCollectionStore } from '@/state/collectionStore';
import { useCallback } from 'react';

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
    <div className="p-4 h-full relative">
      <div className="absolute top-[16px] right-[16px] left-[16px] z-10">
        <div className="flex">
          <Button
            className="hover:bg-transparent gap-1 h-fit"
            size={'sm'}
            variant={'ghost'}
            onClick={handleAddHeader}
          >
            <AddIcon />
            Add Header
          </Button>
          <Button
            className="hover:bg-transparent gap-1 h-fit"
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

      <div className="absolute top-[68px] left-[16px] bottom-[16px] right-[16px]">
        <Table className="table-auto w-full">
          <TableHeader>
            <TableRow>
              <TableHead className="w-auto">Key</TableHead>
              <TableHead className="w-full">Value</TableHead>
              <TableHead className="w-16"> {/* Action Column */} </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {headers.map((header, index) => (
              <TableRow key={index}>
                {/* Editable key field */}
                <TableCell className="w-1/3 break-all">
                  <input
                    type="text"
                    value={header.key}
                    onChange={(e) => handleUpdateHeader(index, { key: e.target.value })}
                    className="w-full bg-transparent outline-none"
                    placeholder="Enter header key"
                  />
                </TableCell>

                <TableCell className="w-full break-all">
                  <input
                    type="text"
                    value={header.value}
                    onChange={(e) => handleUpdateHeader(index, { value: e.target.value })}
                    className="w-full bg-transparent outline-none"
                    placeholder="Enter header value"
                  />
                </TableCell>

                <TableCell className="w-16 text-right">
                  <div className="flex items-center justify-center gap-2">
                    <div className="relative h-4 z-10 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={header.isActive}
                        onChange={(e) => handleUpdateHeader(index, { isActive: e.target.checked })}
                        className="form-checkbox h-4 w-4 appearance-none border rounded-[2px] border-[rgba(107,194,224,1)] bg-[rgba(25,54,65,1)]"
                      />

                      {header.isActive && (
                        <div className="absolute left-0 top-0 h-4 w-4 flex items-center justify-center pointer-events-none rotate-6">
                          <CheckedIcon
                            size={16}
                            viewBox={'0 0 16 16'}
                            color={'rgba(107,194,224,1)'}
                          />
                        </div>
                      )}
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="hover:bg-transparent hover:text-[rgba(107,194,224,1)] active:text-[#12B1E7] h-6 w-6"
                      onClick={() => handleDeleteHeader(index)}
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
