import { useState, useMemo } from 'react';
import { Command, CommandItem, CommandList, CommandGroup } from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { CheckedIcon, DeleteIcon } from '@/components/icons';
import { HEADER_VALUES, COMMON_HEADERS } from '@/constants/index';
import { cn } from '@/lib/utils';
import { TrufosHeader } from 'shim/objects/headers';
import { TableCell, TableRow } from '@/components/ui/table';

type Props = {
  header: TrufosHeader;
  index: number;
  handleUpdateHeader: (index: number, updated: Partial<TrufosHeader>) => void;
  handleDeleteHeader: (index: number) => void;
};

export const HeaderRow = ({ header, index, handleUpdateHeader, handleDeleteHeader }: Props) => {
  const [activeHeaderKeyIndex, setActiveHeaderKeyIndex] = useState<number | null>(null);
  const [activeHeaderValueIndex, setActiveHeaderValueIndex] = useState<number | null>(null);

  const filteredHeaderKeys = useMemo(() => {
    return (COMMON_HEADERS || []).filter((val) =>
      val.toLowerCase().startsWith(header.key.toLowerCase())
    );
  }, [header.key]);

  const filteredHeaderValues = useMemo(() => {
    return (HEADER_VALUES[header.key] || []).filter((val) =>
      val.toLowerCase().startsWith(header.value.toLowerCase())
    );
  }, [header.key, header.value]);

  return (
    <TableRow>
      <TableCell className="w-1/3 break-all">
        <div className="relative">
          <input
            type="text"
            value={header.key}
            onChange={(e) => {
              handleUpdateHeader(index, { key: e.target.value });
              setActiveHeaderKeyIndex(index);
            }}
            className="w-full bg-transparent outline-none"
            placeholder="Enter header key"
            onFocus={() => setActiveHeaderKeyIndex(index)}
            onBlur={() => setTimeout(() => setActiveHeaderKeyIndex(null), 200)}
          />
          {activeHeaderKeyIndex === index && filteredHeaderKeys.length > 0 && (
            <div className="absolute z-50 mt-1 w-full">
              <Command className="max-h-[160px] overflow-y-auto rounded-md border bg-[#111] text-white shadow-md">
                <CommandList>
                  <CommandGroup>
                    {filteredHeaderKeys.map((val) => (
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
        <div className="relative">
          <input
            type="text"
            value={header.value}
            onChange={(e) => {
              handleUpdateHeader(index, { value: e.target.value });
              setActiveHeaderValueIndex(index);
            }}
            className="w-full bg-transparent outline-none"
            placeholder="Enter header value"
            onFocus={() => setActiveHeaderValueIndex(index)}
            onBlur={() => setTimeout(() => setActiveHeaderValueIndex(null), 200)}
          />
          {activeHeaderValueIndex === index && filteredHeaderValues.length > 0 && (
            <div className="absolute z-50 mt-1 w-full">
              <Command className="max-h-[160px] overflow-y-auto rounded-md border bg-[#111] text-white shadow-md">
                <CommandList>
                  <CommandGroup>
                    {filteredHeaderValues.map((val) => (
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
                <CheckedIcon size={16} viewBox="0 0 16 16" color="rgba(107,194,224,1)" />
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
  );
};
