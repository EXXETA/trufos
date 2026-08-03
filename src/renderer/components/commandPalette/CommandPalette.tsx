import { Fragment, useCallback, useEffect, useRef, useState, KeyboardEvent } from 'react';
import {
  ArrowRight,
  EraserIcon,
  FolderPlusIcon,
  Plus,
  Save,
  SettingsIcon,
  SwitchCameraIcon,
  type LucideIcon,
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

type ActionSection = 'Request' | 'Collection' | 'Trufos';
const ACTION_SECTIONS: ActionSection[] = ['Request', 'Collection', 'Trufos'];

interface ActionItem {
  value: string;
  section: ActionSection;
  icon: LucideIcon;
  label: string;
  shortcut?: string;
  disabled?: boolean;
  onSelect: () => void;
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

const TABS = ['all', 'requests', 'environments', 'actions'] as const;
type Tab = (typeof TABS)[number];

/** 2-column grid ancestor: column 1 (method badge) auto-sizes to the widest method text across every subgridded row. */
const REQUEST_LIST_GRID = 'grid grid-cols-[auto_1fr]';
/** Passes the 2 grid tracks down through cmdk's fixed group/heading/items DOM so every request row's columns line up. */
const REQUEST_GROUP_GRID =
  'col-span-full grid grid-cols-subgrid **:[[cmdk-group-heading]]:col-span-full **:[[cmdk-group-items]]:col-span-full **:[[cmdk-group-items]]:grid **:[[cmdk-group-items]]:grid-cols-subgrid';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export const CommandPalette = ({ open, onClose }: CommandPaletteProps) => {
  const [activeTab, setActiveTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');
  const tabsRef = useRef<HTMLDivElement>(null);

  const collection = useCollectionStore((s) => s.collection);
  const requestGroups = collection ? buildRequestGroups(collection.children) : [];
  const allRequests = requestGroups.flatMap((group) => group.requests);
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

  const renderRequestItem = (request: TrufosRequest) => (
    <CommandItem
      key={request.id}
      value={request.title ?? request.url.base}
      onSelect={() => selectAndClose(request.id)}
      className="col-span-full grid grid-cols-subgrid"
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
    </CommandItem>
  );

  const actionItems: ActionItem[] = [
    {
      value: 'send request',
      section: 'Request',
      icon: ArrowRight,
      label: 'Send request',
      shortcut: '⌘↵',
      disabled: currentRequest == null,
      onSelect: handleSend,
    },
    {
      value: 'save request',
      section: 'Request',
      icon: Save,
      label: 'Save request',
      shortcut: '⌘S',
      disabled: currentRequest == null,
      onSelect: handleSave,
    },
    {
      value: 'new request',
      section: 'Request',
      icon: Plus,
      label: 'New request',
      shortcut: '⌘N',
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
      icon: SwitchCameraIcon,
      label: 'Switch environment',
      onSelect: () => setActiveTab('environments'),
    },
    {
      value: 'collection settings',
      section: 'Collection',
      icon: SettingsIcon,
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
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="requests">Requests</TabsTrigger>
                  <TabsTrigger value="environments">Environments</TabsTrigger>
                  <TabsTrigger value="actions">Actions</TabsTrigger>
                </TabsList>

                <Divider />

                <TabsContent value="all" className="mt-0 rounded-none bg-transparent">
                  <CommandList>
                    <CommandEmpty>No results found.</CommandEmpty>
                    {search.trim() === '' ? (
                      <div className={REQUEST_LIST_GRID}>
                        <CommandGroup heading="Recent" className={REQUEST_GROUP_GRID}>
                          {[...allRequests]
                            .sort((a, b) => b.lastModified - a.lastModified)
                            .slice(0, 5)
                            .map(renderRequestItem)}
                        </CommandGroup>
                      </div>
                    ) : (
                      <>
                        <div className={REQUEST_LIST_GRID}>
                          <CommandGroup heading="Requests" className={REQUEST_GROUP_GRID}>
                            {allRequests.map(renderRequestItem)}
                          </CommandGroup>
                        </div>
                        <CommandGroup heading="Environments">
                          {Object.keys(environments).map((key) => (
                            <CommandItem
                              key={key}
                              value={key}
                              onSelect={() => runAndClose(() => selectEnvironment(key))}
                            >
                              <span className="truncate">{key}</span>
                              {selectedEnvironment === key && (
                                <span className="text-muted-foreground ml-auto text-xs">
                                  active
                                </span>
                              )}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                        <CommandGroup heading="Actions">
                          {actionItems.map((item) => (
                            <CommandItem
                              key={item.value}
                              value={item.value}
                              disabled={item.disabled}
                              onSelect={item.onSelect}
                            >
                              <item.icon className="shrink-0" />
                              <span>{item.label}</span>
                              {item.shortcut && (
                                <span className="text-muted-foreground ml-auto text-xs">
                                  {item.shortcut}
                                </span>
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
                    <div className={REQUEST_LIST_GRID}>
                      {requestGroups.map((group, i) => (
                        <Fragment key={group.label ?? '__root__'}>
                          {i > 0 && <CommandSeparator key={`sep-${i}`} className="col-span-full" />}
                          <CommandGroup
                            heading={group.label ?? `${collection?.title} root`}
                            className={REQUEST_GROUP_GRID}
                          >
                            {group.requests.map(renderRequestItem)}
                          </CommandGroup>
                        </Fragment>
                      ))}
                    </div>
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
                              >
                                <item.icon className="shrink-0" />
                                <span>{item.label}</span>
                                {item.shortcut && (
                                  <span className="text-muted-foreground ml-auto text-xs">
                                    {item.shortcut}
                                  </span>
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
