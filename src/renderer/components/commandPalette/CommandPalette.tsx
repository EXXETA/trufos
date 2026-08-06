import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  KeyboardEvent,
  ReactElement,
} from 'react';
import {
  ArrowRight,
  EraserIcon,
  FolderPlusIcon,
  Plus,
  Save,
  SettingsIcon,
  type LucideIcon,
  GalleryVerticalEnd,
  Globe,
  SquareSlash,
  Server,
  Command as CommandShortcut,
  Wrench,
  SquareMousePointer,
  HardDrive,
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
import {
  RequestResultsGrid,
  RequestCommandGroup,
  RequestCommandItem,
} from '@/components/commandPalette/RequestResultsGrid';

const httpService = HttpService.instance;
const eventService = RendererEventService.instance;

interface RequestGroup {
  id: string | null;
  label: string | null;
  requests: TrufosRequest[];
}

type ActionSection = 'Request' | 'Collection' | 'Trufos';
const ACTION_SECTIONS: ActionSection[] = ['Request', 'Collection', 'Trufos'];

interface ActionItem {
  value: string;
  section: ActionSection;
  icon: LucideIcon;
  label: string;
  shortcutModifier?: ReactElement | string;
  shortcutKey?: string;
  disabled?: boolean;
  onSelect: () => void;
}

/**
 * Walk collection children depth-first, flattening nested folders into a single group per folder.
 *
 * Reads folder children from the `folders` Map (always up-to-date after `updateRequest`/
 * `moveItem`/etc.), not the folder object's own embedded `children` — immer may not propagate
 * Map mutations back into the tree references (same defect and same fix as
 * `treeUtilities.ts`'s `flattenTree`).
 */
const buildRequestGroups = (
  children: (Folder | TrufosRequest)[],
  folders: Map<Folder['id'], Folder>,
  folder: Folder | null = null
): RequestGroup[] => {
  const group: RequestGroup = {
    id: folder?.id ?? null,
    label: folder?.title ?? null,
    requests: [],
  };
  const subGroups: RequestGroup[] = [];

  for (const child of children) {
    if (child.type === 'request') {
      group.requests.push(child);
    } else {
      const liveFolder = folders.get(child.id) ?? child;
      subGroups.push(...buildRequestGroups(liveFolder.children, folders, liveFolder));
    }
  }

  return group.requests.length > 0 ? [group, ...subGroups] : subGroups;
};

const TABS = ['all', 'requests', 'environments', 'actions'] as const;
type Tab = (typeof TABS)[number];

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export const CommandPalette = ({ open, onClose }: CommandPaletteProps) => {
  const [activeTab, setActiveTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');
  const tabsRef = useRef<HTMLDivElement>(null);

  const collection = useCollectionStore((s) => s.collection);
  const folders = useCollectionStore((s) => s.folders);
  const requestGroups = collection ? buildRequestGroups(collection.children, folders) : [];
  const allRequests = requestGroups.flatMap((group) => group.requests);
  const currentRequest = useCollectionStore(selectRequest);
  const { setSelectedRequest, addNewRequest, updateRequest, discardChanges, addNewFolder } =
    useCollectionActions();

  const environments = useEnvironmentStore(selectEnvironments);
  const selectedEnvironment = useEnvironmentStore(selectSelectedEnvironment);
  const { selectEnvironment } = useEnvironmentActions();

  const { addResponse } = useResponseActions();

  const { openCollectionSettings, openAppSettings } = useViewActions();

  const isMac = navigator.platform.startsWith('Mac');

  // Reset state when opened
  useEffect(() => {
    if (open) {
      setActiveTab('all');
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

  const renderEnvironmentItem = (key: string) => (
    <CommandItem
      key={key}
      value={key}
      onSelect={() => runAndClose(() => selectEnvironment(key))}
      className="data-[selected='true']:bg-divider"
    >
      <HardDrive className="shrink-0" />
      <span className="truncate">{key}</span>
      {selectedEnvironment === key && (
        <span className="text-muted-foreground ml-auto text-xs">active</span>
      )}
    </CommandItem>
  );

  const renderRequestItem = (request: TrufosRequest) => (
    <RequestCommandItem
      key={request.id}
      value={request.id}
      keywords={[request.title ?? request.url.base]}
      onSelect={() => selectAndClose(request.id)}
    >
      <div
        className="flex items-center justify-center rounded px-2 py-0.5"
        style={{
          backgroundColor: `color-mix(in srgb, var(--http-${request.method.toLowerCase()}) 20%, transparent)`,
        }}
      >
        <span className={`text-xs font-normal ${httpMethodColor(request.method)}`}>
          {request.method}
        </span>
      </div>

      <span className="truncate">{request.title ?? request.url.base}</span>
    </RequestCommandItem>
  );

  const actionItems: ActionItem[] = [
    {
      value: 'send request',
      section: 'Request',
      icon: ArrowRight,
      label: 'Send request',
      shortcutModifier: isMac ? <CommandShortcut size={12} /> : 'Ctrl',
      shortcutKey: 'Enter',
      disabled: currentRequest == null,
      onSelect: handleSend,
    },
    {
      value: 'save request',
      section: 'Request',
      icon: Save,
      label: 'Save request',
      shortcutModifier: isMac ? <CommandShortcut size={12} /> : 'Ctrl',
      shortcutKey: 'S',
      disabled: currentRequest == null,
      onSelect: handleSave,
    },
    {
      value: 'new request',
      section: 'Request',
      icon: Plus,
      label: 'New request',
      shortcutModifier: isMac ? <CommandShortcut size={12} /> : 'Ctrl',
      shortcutKey: 'N',
      onSelect: () => runAndClose(() => addNewRequest()),
    },
    {
      value: 'discard changes',
      section: 'Request',
      icon: EraserIcon,
      label: 'Discard changes',
      disabled: !currentRequest?.draft,
      onSelect: () => runAndClose(discardChanges),
    },
    {
      value: 'new folder',
      section: 'Collection',
      icon: FolderPlusIcon,
      label: 'New folder',
      onSelect: () => runAndClose(() => addNewFolder()),
    },
    {
      value: 'switch environment',
      section: 'Collection',
      icon: SquareMousePointer,
      label: 'Switch environment',
      onSelect: () => setActiveTab('environments'),
    },
    {
      value: 'collection settings',
      section: 'Collection',
      icon: Wrench,
      label: 'Collection settings',
      onSelect: () => runAndClose(openCollectionSettings),
    },
    {
      value: 'settings',
      section: 'Trufos',
      icon: SettingsIcon,
      label: 'Settings',
      onSelect: () => runAndClose(openAppSettings),
    },
  ];

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
                  <TabsTrigger className="gap-2 rounded-md px-1.5 py-1" value="all">
                    <GalleryVerticalEnd size={16} />

                    <span>All</span>
                  </TabsTrigger>
                  <TabsTrigger className="gap-2 rounded-md px-1.5 py-1" value="requests">
                    <Globe size={16} />

                    <span>Requests</span>
                  </TabsTrigger>
                  <TabsTrigger className="gap-2 rounded-md px-1.5 py-1" value="environments">
                    <Server size={16} />

                    <span>Environments</span>
                  </TabsTrigger>
                  <TabsTrigger className="gap-2 rounded-md px-1.5 py-1" value="actions">
                    <SquareSlash size={16} />

                    <span>Actions</span>
                  </TabsTrigger>
                </TabsList>

                <Divider />

                <TabsContent value="all" className="mt-0 rounded-none bg-transparent">
                  <CommandList>
                    <CommandEmpty>No results found.</CommandEmpty>
                    {search.trim() === '' ? (
                      <RequestResultsGrid>
                        <RequestCommandGroup heading="Recent">
                          {[...allRequests]
                            .sort((a, b) => b.lastModified - a.lastModified)
                            .slice(0, 5)
                            .map(renderRequestItem)}
                        </RequestCommandGroup>
                      </RequestResultsGrid>
                    ) : (
                      <>
                        <RequestResultsGrid>
                          <RequestCommandGroup heading="Requests">
                            {allRequests.map(renderRequestItem)}
                          </RequestCommandGroup>
                        </RequestResultsGrid>
                        <CommandGroup heading="Environments">
                          {Object.keys(environments).map(renderEnvironmentItem)}
                        </CommandGroup>
                        <CommandGroup heading="Actions">
                          {actionItems.map((item) => (
                            <CommandItem
                              key={item.value}
                              value={item.value}
                              disabled={item.disabled}
                              onSelect={item.onSelect}
                              className="data-[selected='true']:bg-divider"
                            >
                              <item.icon className="shrink-0" />
                              <span>{item.label}</span>
                              {item.shortcutModifier && (
                                <div className="ml-auto flex items-center justify-center gap-1">
                                  <div className="bg-background-secondary rounded p-1">
                                    {item.shortcutModifier}
                                  </div>

                                  <span className="bg-background-secondary rounded p-1">
                                    {item.shortcutKey}
                                  </span>
                                </div>
                              )}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </>
                    )}
                  </CommandList>
                </TabsContent>

                <TabsContent value="requests" className="mt-0 rounded-none bg-transparent">
                  <CommandList>
                    <CommandEmpty>No requests found.</CommandEmpty>
                    <RequestResultsGrid>
                      {requestGroups.map((group, i) => (
                        <Fragment key={group.id ?? '__root__'}>
                          {i > 0 && <CommandSeparator key={`sep-${i}`} className="col-span-full" />}
                          <RequestCommandGroup heading={group.label ?? `${collection?.title} root`}>
                            {group.requests.map(renderRequestItem)}
                          </RequestCommandGroup>
                        </Fragment>
                      ))}
                    </RequestResultsGrid>
                  </CommandList>
                </TabsContent>

                <TabsContent value="environments" className="mt-0 rounded-none bg-transparent">
                  <CommandList>
                    <CommandEmpty>No environments found.</CommandEmpty>
                    {Object.keys(environments).map(renderEnvironmentItem)}
                  </CommandList>
                </TabsContent>

                <TabsContent value="actions" className="mt-0 rounded-none bg-transparent">
                  <CommandList>
                    <CommandEmpty>No actions available.</CommandEmpty>
                    {ACTION_SECTIONS.map((section, i) => (
                      <Fragment key={section}>
                        {i > 0 && <CommandSeparator />}
                        <CommandGroup heading={section}>
                          {actionItems
                            .filter((item) => item.section === section)
                            .map((item) => (
                              <CommandItem
                                key={item.value}
                                value={item.value}
                                disabled={item.disabled}
                                onSelect={item.onSelect}
                                className="data-[selected='true']:bg-divider"
                              >
                                <item.icon className="shrink-0" />
                                <span>{item.label}</span>
                                {item.shortcutModifier && (
                                  <div className="ml-auto flex items-center justify-center gap-1">
                                    <div className="bg-background-secondary rounded p-1">
                                      {item.shortcutModifier}
                                    </div>

                                    <span className="bg-background-secondary rounded p-1">
                                      {item.shortcutKey}
                                    </span>
                                  </div>
                                )}
                              </CommandItem>
                            ))}
                        </CommandGroup>
                      </Fragment>
                    ))}
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
