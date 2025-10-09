import { useState, useMemo } from 'react';
import { Command, CommandItem, CommandList, CommandGroup } from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { CheckedIcon, DeleteIcon } from '@/components/icons';
import { HEADER_VALUES, COMMON_HEADERS } from '@/constants';
import { cn } from '@/lib/utils';
import { TrufosHeader } from 'shim/objects/headers';
import { TableCell, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

type Props = {
  header: TrufosHeader;
  index: number;
  handleUpdateHeader: (index: number, updated: Partial<TrufosHeader>) => void;
  handleDeleteHeader: (index: number) => void;
};

export const HeaderRow = ({ header, index, handleUpdateHeader, handleDeleteHeader }: Props) => {
  const [isKeyPopoverOpen, setIsKeyPopoverOpen] = useState(false);
  const [isValuePopoverOpen, setIsValuePopoverOpen] = useState(false);

  const filteredHeaderKeys = useMemo(
    () => COMMON_HEADERS.filter((val) => val.toLowerCase().startsWith(header.key.toLowerCase())),
    [header.key]
  );

  const filteredHeaderValues = useMemo(
    () =>
      (HEADER_VALUES[header.key] ?? []).filter((val) =>
        val.toLowerCase().startsWith(header.value.toLowerCase())
      ),
    [header.key, header.value]
  );

  return (
    <TableRow>
      <TableCell className="w-1/3 break-all">
        <Popover
          open={isKeyPopoverOpen && filteredHeaderKeys.length > 0}
          onOpenChange={setIsKeyPopoverOpen}
        >
          <PopoverTrigger asChild>
            <div className="w-full">
              <input
                type="text"
                value={header.key}
                onChange={(e) => {
                  handleUpdateHeader(index, { key: e.target.value });
                  setIsKeyPopoverOpen(true);
                }}
                className="w-full bg-transparent outline-hidden"
                placeholder="Enter header key"
              />
            </div>
          </PopoverTrigger>
          <PopoverContent
            className="w-auto p-0"
            onOpenAutoFocus={(e) => e.preventDefault()}
            onInteractOutside={() => setIsKeyPopoverOpen(false)}
          >
            <Command className="max-h-[160px] overflow-y-auto rounded-md border bg-background-primary text-text-primary shadow-md">
              <CommandList>
                <CommandGroup>
                  {filteredHeaderKeys.map((val) => (
                    <CommandItem
                      key={val}
                      value={val}
                      onSelect={() => {
                        handleUpdateHeader(index, { key: val });
                        setIsKeyPopoverOpen(false);
                      }}
                    >
                      {val}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </TableCell>

      <TableCell className="w-full break-all">
        <Popover
          open={isValuePopoverOpen && filteredHeaderValues.length > 0}
          onOpenChange={setIsValuePopoverOpen}
        >
          <PopoverTrigger asChild>
            <div className="w-full">
              <input
                type="text"
                value={header.value}
                onChange={(e) => {
                  handleUpdateHeader(index, { value: e.target.value });
                  setIsValuePopoverOpen(true);
                }}
                className="w-full bg-transparent outline-hidden"
                placeholder="Enter header value"
              />
            </div>
          </PopoverTrigger>
          <PopoverContent
            className="w-auto p-0"
            onOpenAutoFocus={(e) => e.preventDefault()}
            onInteractOutside={() => setIsValuePopoverOpen(false)}
          >
            <Command className="max-h-[160px] overflow-y-auto rounded-md border bg-background-primary text-text-primary shadow-md">
              <CommandList>
                <CommandGroup>
                  {filteredHeaderValues.map((val) => (
                    <CommandItem
                      key={val}
                      value={val}
                      onSelect={() => {
                        handleUpdateHeader(index, { value: val });
                        setIsValuePopoverOpen(false);
                      }}
                    >
                      {val}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </TableCell>

      <TableCell className="w-16 text-right">
        <div className="flex items-center justify-center gap-2">
          <div className="relative z-10 h-4 cursor-pointer">
            <input
              type="checkbox"
              checked={header.isActive}
              onChange={(e) => handleUpdateHeader(index, { isActive: e.target.checked })}
              className={cn('form-checkbox h-4 w-4 appearance-none rounded-[2px] border', {
                'border-accent-primary bg-accent-tertiary': header.isActive,
                'border-text-primary bg-transparent': !header.isActive,
              })}
            />
            {header.isActive && (
              <div className="pointer-events-none absolute left-0 top-0 flex h-4 w-4 rotate-6 items-center justify-center">
                <CheckedIcon size={16} viewBox="0 0 16 16" color="var(--accent-primary)" />
              </div>
            )}
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 hover:bg-transparent hover:text-accent-primary active:text-accent-secondary"
            onClick={() => handleDeleteHeader(index)}
          >
            <DeleteIcon />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
};
