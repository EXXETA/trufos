import { Fragment, useCallback, useEffect, useRef, useState, KeyboardEvent } from 'react';
import {
  ArrowRight,
  EraserIcon,
  FolderPlusIcon,
  Plus,
  Save,
  SettingsIcon,
  SwitchCameraIcon,
} from 'lucide-react';
import { Folder } from 'shim/objects/folder';
import { TrufosRequest } from 'shim/objects/request';
import { editor } from 'monaco-editor';
import { Dialog, DialogOverlay, DialogPortal } from '@/components/ui/dialog';
import * as DialogPrimitive from '@radix-ui/react-dialog';
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
import { useViewActions } from '@/state/viewStore';
import { HttpService } from '@/services/http/http-service';
import { RendererEventService } from '@/services/event/renderer-event-service';
import { saveModelContent } from '@/lib/monaco/models';
import { showError } from '@/error/errorHandler';
import { httpMethodColor } from '@/services/StyleHelper';
import { Divider } from '@/components/shared/Divider';

const httpService = HttpService.instance;
const eventService = RendererEventService.instance;

interface RequestGroup {
  label: string | null;
  requests: TrufosRequest[];
}

/** Walk collection children depth-first, flattening nested folders into a single group per folder. */
const buildRequestGroups = (
  children: (Folder | TrufosRequest)[],
  label: string | null = null
): RequestGroup[] => {
  const group: RequestGroup = { label, requests: [] };
  const subGroups: RequestGroup[] = [];

  for (const child of children) {
    if (child.type === 'request') {
      group.requests.push(child);
    } else {
      subGroups.push(...buildRequestGroups(child.children, child.title));
    }
  }

  return group.requests.length > 0 ? [group, ...subGroups] : subGroups;
};

const TABS = ['requests', 'environments', 'actions'] as const;
type Tab = (typeof TABS)[number];

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export const CommandPalette = ({ open, onClose }: CommandPaletteProps) => {
  const [activeTab, setActiveTab] = useState<Tab>('requests');
  const [search, setSearch] = useState('');
  const tabsRef = useRef<HTMLDivElement>(null);

  const collection = useCollectionStore((s) => s.collection);
  const requestGroups = collection ? buildRequestGroups(collection.children) : [];
  const currentRequest = useCollectionStore(selectRequest);
  const { setSelectedRequest, addNewRequest, updateRequest, discardChanges, addNewFolder } =
    useCollectionActions();

  const environments = useEnvironmentStore(selectEnvironments);
  const selectedEnvironment = useEnvironmentStore(selectSelectedEnvironment);
  const { selectEnvironment } = useEnvironmentActions();

  const { addResponse } = useResponseActions();

  const { openCollectionSettings, openAppSettings } = useViewActions();

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
    (e: KeyboardEvent<HTMLDivElement>) => {
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
      <DialogPortal>
        <DialogOverlay className="flex items-center justify-center">
          <DialogPrimitive.Content className="bg-background w-full max-w-150 overflow-hidden rounded-lg p-2 shadow-lg outline-none">
            <Command shouldFilter={true} onKeyDown={handleKeyDown}>
              <CommandInput placeholder="Search..." value={search} onValueChange={setSearch} />

              <Tabs
                ref={tabsRef}
                value={activeTab}
                onValueChange={(v) => setActiveTab(v as Tab)}
                className="flex flex-col gap-2"
              >
                <TabsList className="mt-2 px-2">
                  <TabsTrigger value="requests">Requests</TabsTrigger>
                  <TabsTrigger value="environments">Environments</TabsTrigger>
                  <TabsTrigger value="actions">Actions</TabsTrigger>
                </TabsList>

                <Divider />

                <TabsContent value="requests" className="mt-0 rounded-none bg-transparent">
                  <CommandList>
                    <CommandEmpty>No requests found.</CommandEmpty>
                    {requestGroups.map((group, i) => (
                      <Fragment key={group.label ?? '__root__'}>
                        {i > 0 && <CommandSeparator key={`sep-${i}`} />}
                        <CommandGroup heading={group.label ?? `${collection?.title} root`}>
                          {group.requests.map((request) => (
                            <CommandItem
                              key={request.id}
                              value={request.title ?? request.url.base}
                              onSelect={() => selectAndClose(request.id)}
                            >
                              <span
                                className={`shrink-0 text-xs font-normal ${httpMethodColor(request.method)}`}
                              >
                                {request.method}
                              </span>
                              <span className="truncate">{request.title ?? request.url.base}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </Fragment>
                    ))}
                  </CommandList>
                </TabsContent>

                <TabsContent value="environments">
                  <CommandList>
                    <CommandEmpty>No environments found.</CommandEmpty>
                    {Object.keys(environments).map((key) => (
                      <CommandItem
                        key={key}
                        value={key}
                        onSelect={() => runAndClose(() => selectEnvironment(key))}
                      >
                        <span className="truncate">{key}</span>
                        {selectedEnvironment === key && (
                          <span className="text-muted-foreground ml-auto text-xs">active</span>
                        )}
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
                      <CommandItem
                        value="discard changes"
                        disabled={!currentRequest?.draft}
                        onSelect={() => runAndClose(discardChanges)}
                      >
                        <EraserIcon className="shrink-0" />
                        <span>Discard changes</span>
                      </CommandItem>
                    </CommandGroup>

                    <CommandSeparator />

                    <CommandGroup heading="Collection">
                      <CommandItem
                        value="new folder"
                        onSelect={() => runAndClose(() => addNewFolder())}
                      >
                        <FolderPlusIcon className="shrink-0" />
                        <span>New folder</span>
                      </CommandItem>
                      <CommandItem
                        value="switch environment"
                        onSelect={() => setActiveTab('environments')}
                      >
                        <SwitchCameraIcon className="shrink-0" />
                        <span>Switch environment</span>
                      </CommandItem>
                      <CommandItem
                        value="collection settings"
                        onSelect={() => runAndClose(openCollectionSettings)}
                      >
                        <SettingsIcon className="shrink-0" />
                        <span>Collection settings</span>
                      </CommandItem>
                    </CommandGroup>

                    <CommandSeparator />

                    <CommandGroup heading="Trufos">
                      <CommandItem value="settings" onSelect={() => runAndClose(openAppSettings)}>
                        <SettingsIcon className="shrink-0" />
                        <span>Settings</span>
                      </CommandItem>
                    </CommandGroup>
                  </CommandList>
                </TabsContent>
              </Tabs>
            </Command>
          </DialogPrimitive.Content>
        </DialogOverlay>
      </DialogPortal>
    </Dialog>
  );
};
