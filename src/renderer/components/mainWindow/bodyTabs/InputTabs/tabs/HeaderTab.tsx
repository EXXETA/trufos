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
import { useCallback, useState } from 'react';
import { HEADER_VALUES, COMMON_HEADERS } from '@/constants/index';
import { Command, CommandItem, CommandList, CommandGroup } from '@/components/ui/command';

export const HeaderTab = () => {
  const [activeHeaderKeyIndex, setActiveHeaderKeyIndex] = useState<number | null>(null);
  const [activeHeaderValueIndex, setActiveHeaderValueIndex] = useState<number | null>(null);

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
              <TableRow key={index}>
                {/* Editable key field */}
                <TableCell className="w-1/3 break-all">
                  {/* <input
                    type="text"
                    value={header.key}
                    onChange={(e) => handleUpdateHeader(index, { key: e.target.value })}
                    className="w-full bg-transparent outline-none"
                    placeholder="Enter header key"
                  /> */}
                  <div className="relative">
                    <input
                      type="text"
                      value={header.key}
                      onChange={(e) => {
                        handleUpdateHeader(index, { key: e.target.value });
                        setActiveHeaderKeyIndex(index); // manage showing only for this row
                      }}
                      className="w-full bg-transparent outline-none"
                      placeholder="Enter header value"
                      onFocus={() => setActiveHeaderKeyIndex(index)}
                      onBlur={() => setTimeout(() => setActiveHeaderKeyIndex(null), 200)} // delay to allow click
                    />

                    {activeHeaderKeyIndex === index &&
                      (COMMON_HEADERS || []).filter((val) =>
                        val.toLowerCase().startsWith(header.key.toLowerCase())
                      ).length > 0 && (
                        <div className="absolute z-50 mt-1 w-full">
                          <Command className="max-h-[160px] overflow-y-auto rounded-md border bg-[#111] text-white shadow-md">
                            <CommandList>
                              <CommandGroup>
                                {(COMMON_HEADERS || [])
                                  .filter((val) =>
                                    val.toLowerCase().startsWith(header.key.toLowerCase())
                                  )
                                  .map((val) => (
                                    <CommandItem
                                      key={val}
                                      value={val}
                                      onSelect={() => {
                                        handleUpdateHeader(index, { key: val });
                                        setActiveHeaderKeyIndex(null);
                                      }}
                                    >
                                      {val}
                                    </CommandItem>
                                  ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </div>
                      )}
                  </div>
                </TableCell>

                <TableCell className="w-full break-all">
                  {/* <input
                    type="text"
                    value={header.value}
                    onChange={(e) => handleUpdateHeader(index, { value: e.target.value })}
                    className="w-full bg-transparent outline-none"
                    placeholder="Enter header value"
                  /> */}
                  <div className="relative">
                    <input
                      type="text"
                      value={header.value}
                      onChange={(e) => {
                        handleUpdateHeader(index, { value: e.target.value });
                        setActiveHeaderValueIndex(index); // manage showing only for this row
                      }}
                      className="w-full bg-transparent outline-none"
                      placeholder="Enter header value"
                      onFocus={() => setActiveHeaderValueIndex(index)}
                      onBlur={() => setTimeout(() => setActiveHeaderValueIndex(null), 200)} // delay to allow click
                    />

                    {activeHeaderValueIndex === index &&
                      (HEADER_VALUES[header.key] || []).filter((val) =>
                        val.toLowerCase().startsWith(header.value.toLowerCase())
                      ).length > 0 && (
                        <div className="absolute z-50 mt-1 w-full">
                          <Command className="max-h-[160px] overflow-y-auto rounded-md border bg-[#111] text-white shadow-md">
                            <CommandList>
                              <CommandGroup>
                                {(HEADER_VALUES[header.key] || [])
                                  .filter((val) =>
                                    val.toLowerCase().startsWith(header.value.toLowerCase())
                                  )
                                  .map((val) => (
                                    <CommandItem
                                      key={val}
                                      value={val}
                                      onSelect={() => {
                                        handleUpdateHeader(index, { value: val });
                                        setActiveHeaderValueIndex(null);
                                      }}
                                    >
                                      {val}
                                    </CommandItem>
                                  ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </div>
                      )}
                  </div>
                </TableCell>

                <TableCell className="w-16 text-right">
                  <div className="flex items-center justify-center gap-2">
                    <div className="relative z-10 h-4 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={header.isActive}
                        onChange={(e) => handleUpdateHeader(index, { isActive: e.target.checked })}
                        className={cn(
                          'form-checkbox h-4 w-4 appearance-none rounded-[2px] border',
                          header.isActive
                            ? 'border-[rgba(107,194,224,1)] bg-[rgba(25,54,65,1)]'
                            : 'border-[rgba(238,238,238,1)] bg-transparent'
                        )}
                      />

                      {header.isActive && (
                        <div className="pointer-events-none absolute left-0 top-0 flex h-4 w-4 rotate-6 items-center justify-center">
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
                      className="h-6 w-6 hover:bg-transparent hover:text-[rgba(107,194,224,1)] active:text-[#12B1E7]"
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
