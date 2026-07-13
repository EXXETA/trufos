import { useCallback, useEffect, useRef, useState } from 'react';
import { Folder, Globe } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useCollectionActions, useCollectionStore } from '@/state/collectionStore';
import { httpMethodColor } from '@/services/StyleHelper';

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

  const requests = useCollectionStore((s) => s.requests);
  const folders = useCollectionStore((s) => s.folders);
  const collection = useCollectionStore((s) => s.collection);
  const { setSelectedRequest } = useCollectionActions();

  // Reset state when opened
  useEffect(() => {
    if (open) {
      setActiveTab('requests');
      setSearch('');
    }
  }, [open]);

  const selectAndClose = useCallback(
    (id: string) => {
      setSelectedRequest(id);
      onClose();
    },
    [setSelectedRequest, onClose]
  );

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
      <DialogContent className="top-[280px] translate-y-0 overflow-hidden p-0 shadow-lg sm:max-w-[600px]">
        <Command shouldFilter={true} onKeyDown={handleKeyDown}>
          <CommandInput placeholder="Search..." value={search} onValueChange={setSearch} />
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
                {Array.from(requests.values()).map((request) => (
                  <CommandItem
                    key={request.id}
                    value={request.title ?? request.url.base}
                    onSelect={() => selectAndClose(request.id)}
                  >
                    <span className={`shrink-0 text-xs font-normal ${httpMethodColor(request.method)}`}>
                      {request.method}
                    </span>
                    <span className="truncate">{request.title ?? request.url.base}</span>
                  </CommandItem>
                ))}
              </CommandList>
            </TabsContent>

            <TabsContent value="collections">
              <CommandList>
                <CommandEmpty>No collections found.</CommandEmpty>
                {collection != null && (
                  <CommandItem key={collection.id} value={collection.title}>
                    <Globe className="shrink-0" />
                    <span className="truncate">{collection.title}</span>
                  </CommandItem>
                )}
              </CommandList>
            </TabsContent>

            <TabsContent value="folders">
              <CommandList>
                <CommandEmpty>No folders found.</CommandEmpty>
                {Array.from(folders.values()).map((folder) => (
                  <CommandItem key={folder.id} value={folder.title}>
                    <Folder className="shrink-0" />
                    <span className="truncate">{folder.title}</span>
                  </CommandItem>
                ))}
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
