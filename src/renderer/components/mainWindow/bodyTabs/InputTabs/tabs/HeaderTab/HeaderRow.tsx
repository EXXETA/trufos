import { useState, useMemo } from 'react';
import { Command, CommandItem, CommandList, CommandGroup } from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { DeleteIcon } from '@/components/icons';
import { HEADER_VALUES, COMMON_HEADERS } from '@/constants';
import { ActiveCheckbox } from '@/components/shared/ActiveCheckbox';
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
            <Command className="bg-background-primary text-text-primary max-h-[160px] overflow-y-auto rounded-md border shadow-md">
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
            <Command className="bg-background-primary text-text-primary max-h-[160px] overflow-y-auto rounded-md border shadow-md">
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
          <ActiveCheckbox
            checked={header.isActive}
            onChange={(checked) => handleUpdateHeader(index, { isActive: checked })}
          />

          <Button
            variant="ghost"
            size="icon"
            className="hover:text-accent-primary active:text-accent-secondary h-6 w-6 hover:bg-transparent"
            onClick={() => handleDeleteHeader(index)}
          >
            <DeleteIcon size={30} viewBox="0 4 24 24" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
};
