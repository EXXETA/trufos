import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
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
  Wrench,
  SquareMousePointer,
  HardDrive,
} from 'lucide-react';
import { Folder } from 'shim/objects/folder';
import { TrufosRequest } from 'shim/objects/request';
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
import { useViewActions } from '@/state/viewStore';
import { httpMethodColor } from '@/services/StyleHelper';
import { Divider } from '@/components/shared/Divider';
import {
  RequestResultsGrid,
  RequestCommandGroup,
  RequestCommandItem,
} from '@/components/commandPalette/RequestResultsGrid';
import { useSendRequest, useSaveRequest } from '@/hooks/request/useRequestActions';
import { useHotkeys } from '@/hooks/hotKeys/useHotkey';
import { HOTKEYS } from '@/hooks/hotKeys/hotkeys';
import { formatHotkeyForDisplay } from '@/hooks/hotKeys/hotkeyDisplay';

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
  /** A `HOTKEYS.*` value; omit when the action has no real bound hotkey. */
  hotkey?: string;
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
  const { setSelectedRequest, discardChanges, addNewFolder } = useCollectionActions();

  const environments = useEnvironmentStore(selectEnvironments);
  const selectedEnvironment = useEnvironmentStore(selectSelectedEnvironment);
  const { selectEnvironment } = useEnvironmentActions();

  const { openCollectionSettings, openAppSettings, requestCreateItem } = useViewActions();

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

  const { sendRequest } = useSendRequest();
  const { saveRequest } = useSaveRequest();

  const handleSend = useCallback(async () => {
    await sendRequest();
    onClose();
  }, [sendRequest, onClose]);

  const handleSave = useCallback(async () => {
    await saveRequest();
    onClose();
  }, [saveRequest, onClose]);

  const handleNewRequest = useCallback(() => {
    if (collection == null) return;
    runAndClose(() => requestCreateItem({ type: 'request', parentId: collection.id }));
  }, [collection, runAndClose, requestCreateItem]);

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

  const canSendRequest = currentRequest != null;
  const canSaveRequest = !!currentRequest?.draft;
  const canCreateRequest = collection != null;

  const actionItems: ActionItem[] = [
    {
      value: 'send request',
      section: 'Request',
      icon: ArrowRight,
      label: 'Send request',
      hotkey: HOTKEYS.sendRequest,
      disabled: !canSendRequest,
      onSelect: handleSend,
    },
    {
      value: 'save request',
      section: 'Request',
      icon: Save,
      label: 'Save request',
      hotkey: HOTKEYS.saveRequest,
      disabled: !canSaveRequest,
      onSelect: handleSave,
    },
    {
      value: 'new request',
      section: 'Request',
      icon: Plus,
      label: 'New request',
      hotkey: HOTKEYS.newRequest,
      disabled: !canCreateRequest,
      onSelect: handleNewRequest,
    },
    {
      value: 'discard changes',
      section: 'Request',
      icon: EraserIcon,
      label: 'Discard changes',
      disabled: !canSaveRequest,
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

  const cycleTabForward = useCallback(() => {
    const currentIndex = TABS.indexOf(activeTab);
    setActiveTab(TABS[(currentIndex + 1) % TABS.length]);
  }, [activeTab]);

  const cycleTabBackward = useCallback(() => {
    const currentIndex = TABS.indexOf(activeTab);
    setActiveTab(TABS[(currentIndex - 1 + TABS.length) % TABS.length]);
  }, [activeTab]);

  // Owns every keyboard shortcut scoped to the open palette: Send/Save/New-request (a keypress
  // performs the same action and closes the palette exactly like clicking the corresponding
  // Actions-tab item does) and tab-strip cycling via Tab/Shift+Tab/←/→.
  // `MainTopBar.tsx`/`SidebarHeaderBar.tsx` disable their own global registrations for the shared
  // Send/Save/New-request shortcuts while the palette is open, so those never fire twice.
  useHotkeys(
    [
      { keys: HOTKEYS.sendRequest, handler: handleSend, enabled: canSendRequest },
      { keys: HOTKEYS.saveRequest, handler: handleSave, enabled: canSaveRequest },
      { keys: HOTKEYS.newRequest, handler: handleNewRequest, enabled: canCreateRequest },
      { keys: HOTKEYS.cyclePaletteTabForward, handler: cycleTabForward },
      { keys: HOTKEYS.cyclePaletteTabForwardTab, handler: cycleTabForward },
      { keys: HOTKEYS.cyclePaletteTabBackward, handler: cycleTabBackward },
      { keys: HOTKEYS.cyclePaletteTabBackwardTab, handler: cycleTabBackward },
    ],
    { enabled: open, skipFormElements: false }
  );

  const renderActionItem = (item: ActionItem) => {
    const badge = item.hotkey ? formatHotkeyForDisplay(item.hotkey) : null;

    return (
      <CommandItem
        key={item.value}
        value={item.value}
        disabled={item.disabled}
        onSelect={item.onSelect}
        className="data-[selected='true']:bg-divider"
      >
        <item.icon className="shrink-0" />
        <span>{item.label}</span>
        {badge && (
          <div className="ml-auto flex items-center justify-center gap-1">
            <div className="bg-background-secondary rounded p-1">{badge.modifier}</div>

            <span className="bg-background-secondary rounded p-1">{badge.key}</span>
          </div>
        )}
      </CommandItem>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogPortal>
        <DialogOverlay className="flex items-center justify-center">
          <DialogPrimitive.Content
            className="bg-background w-full max-w-150 overflow-hidden rounded-lg p-2 shadow-lg outline-none"
            // Radix's default onCloseAutoFocus returns focus to whatever triggered the dialog once
            // it finishes closing. This dialog is opened via a global shortcut (mod+k), not a
            // button with a meaningful "return focus here" target, and without overriding this it
            // can fight with the inline-rename input the sidebar auto-focuses in the same tick the
            // palette closes (e.g. after "New request").
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            <Command shouldFilter={true}>
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
                          {actionItems.map(renderActionItem)}
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
                            .map(renderActionItem)}
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
