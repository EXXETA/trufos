import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Folder, Globe, Plus, Save, SwitchCamera } from 'lucide-react';
import { editor } from 'monaco-editor';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { selectRequest, useCollectionActions, useCollectionStore } from '@/state/collectionStore';
import {
  selectEnvironments,
  selectSelectedEnvironment,
  useEnvironmentActions,
  useEnvironmentStore,
} from '@/state/environmentStore';
import { useResponseActions } from '@/state/responseStore';
import { HttpService } from '@/services/http/http-service';
import { RendererEventService } from '@/services/event/renderer-event-service';
import { saveModelContent } from '@/lib/monaco/models';
import { showError } from '@/error/errorHandler';
import { httpMethodColor } from '@/services/StyleHelper';

const httpService = HttpService.instance;
const eventService = RendererEventService.instance;

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
  const currentRequest = useCollectionStore(selectRequest);
  const { setSelectedRequest, addNewRequest, updateRequest } = useCollectionActions();

  const environments = useEnvironmentStore(selectEnvironments);
  const selectedEnvironment = useEnvironmentStore(selectSelectedEnvironment);
  const { selectEnvironment } = useEnvironmentActions();

  const { addResponse } = useResponseActions();

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

  const runAndClose = useCallback(
    (action: () => void) => {
      action();
      onClose();
    },
    [onClose]
  );

  const handleSend = useCallback(async () => {
    if (currentRequest == null) return;
    try {
      await Promise.all(editor.getModels().map(saveModelContent));
      const response = await httpService.sendRequest(currentRequest);
      addResponse(currentRequest.id, response);
    } catch (error) {
      showError(error);
    }
    onClose();
  }, [currentRequest, addResponse, onClose]);

  const handleSave = useCallback(async () => {
    if (currentRequest == null) return;
    try {
      await Promise.all(editor.getModels().map(saveModelContent));
      updateRequest(await eventService.saveChanges(currentRequest), true);
    } catch (error) {
      showError(error);
    }
    onClose();
  }, [currentRequest, updateRequest, onClose]);

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
                <CommandGroup heading="Request">
                  <CommandItem
                    value="send request"
                    disabled={currentRequest == null}
                    onSelect={handleSend}
                  >
                    <ArrowRight className="shrink-0" />
                    <span>Send request</span>
                    <span className="text-muted-foreground ml-auto text-xs">⌘↵</span>
                  </CommandItem>
                  <CommandItem
                    value="save request"
                    disabled={currentRequest == null}
                    onSelect={handleSave}
                  >
                    <Save className="shrink-0" />
                    <span>Save request</span>
                    <span className="text-muted-foreground ml-auto text-xs">⌘S</span>
                  </CommandItem>
                  <CommandItem
                    value="new request"
                    onSelect={() => runAndClose(() => addNewRequest())}
                  >
                    <Plus className="shrink-0" />
                    <span>New request</span>
                    <span className="text-muted-foreground ml-auto text-xs">⌘N</span>
                  </CommandItem>
                </CommandGroup>
                {Object.keys(environments).length > 0 && (
                  <>
                    <CommandSeparator />
                    <CommandGroup heading="Switch environment">
                      {Object.keys(environments).map((key) => (
                        <CommandItem
                          key={key}
                          value={`switch environment ${key}`}
                          onSelect={() => runAndClose(() => selectEnvironment(key))}
                        >
                          <SwitchCamera className="shrink-0" />
                          <span>{key}</span>
                          {selectedEnvironment === key && (
                            <span className="text-muted-foreground ml-auto text-xs">active</span>
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </>
                )}
              </CommandList>
            </TabsContent>
          </Tabs>
        </Command>
      </DialogContent>
    </Dialog>
  );
};
