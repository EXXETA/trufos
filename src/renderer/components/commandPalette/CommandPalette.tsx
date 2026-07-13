import { useCallback, useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandList,
} from '@/components/ui/command';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

const TABS = ['requests', 'collections', 'folders', 'actions'] as const;
type Tab = (typeof TABS)[number];

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export const CommandPalette = ({ open, onClose }: CommandPaletteProps) => {
  const [activeTab, setActiveTab] = useState<Tab>('requests');
  const [search, setSearch] = useState('');
  const tabsRef = useRef<HTMLDivElement>(null);

  // Reset state when opened
  useEffect(() => {
    if (open) {
      setActiveTab('requests');
      setSearch('');
    }
  }, [open]);

  // Tab/Shift+Tab and Left/Right arrow key cycling
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const currentIndex = TABS.indexOf(activeTab);

      if (e.key === 'ArrowRight' || (e.key === 'Tab' && !e.shiftKey)) {
        e.preventDefault();
        setActiveTab(TABS[(currentIndex + 1) % TABS.length]);
      } else if (e.key === 'ArrowLeft' || (e.key === 'Tab' && e.shiftKey)) {
        e.preventDefault();
        setActiveTab(TABS[(currentIndex - 1 + TABS.length) % TABS.length]);
      }
    },
    [activeTab]
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="top-[280px] translate-y-0 overflow-hidden p-0 shadow-lg sm:max-w-[600px]"
      >
        <Command shouldFilter={true} onKeyDown={handleKeyDown}>
          <CommandInput
            placeholder="Search..."
            value={search}
            onValueChange={setSearch}
          />
          <Tabs
            ref={tabsRef}
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as Tab)}
            className="flex flex-col"
          >
            <TabsList className="border-b px-2">
              <TabsTrigger value="requests">Requests</TabsTrigger>
              <TabsTrigger value="collections">Collections</TabsTrigger>
              <TabsTrigger value="folders">Folders</TabsTrigger>
              <TabsTrigger value="actions">Actions</TabsTrigger>
            </TabsList>
            <TabsContent value="requests">
              <CommandList>
                <CommandEmpty>No requests found.</CommandEmpty>
              </CommandList>
            </TabsContent>
            <TabsContent value="collections">
              <CommandList>
                <CommandEmpty>No collections found.</CommandEmpty>
              </CommandList>
            </TabsContent>
            <TabsContent value="folders">
              <CommandList>
                <CommandEmpty>No folders found.</CommandEmpty>
              </CommandList>
            </TabsContent>
            <TabsContent value="actions">
              <CommandList>
                <CommandEmpty>No actions available.</CommandEmpty>
              </CommandList>
            </TabsContent>
          </Tabs>
        </Command>
      </DialogContent>
    </Dialog>
  );
};
