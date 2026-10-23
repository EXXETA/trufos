import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { useStateResettable } from '@/util/react-util';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RendererEventService } from '@/services/event/renderer-event-service';
import { useCollectionActions } from '@/state/collectionStore';
import { Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { FilePicker } from '@/components/ui/file-picker';
import { DroppedEntryInfo } from '@/components/ui/file-drop-zone';
import { FolderPlusIcon, FolderSearchIcon } from '@/components/icons';
import type { ImportStrategy } from 'shim/event-service';
import type { ImportWarning, IndexedImporter } from 'shim/plugin';
import { selectPluginContributions, usePluginStore } from '@/state/pluginStore';
import { showError } from '@/error/errorHandler';
import { toast } from '@/components/ui/sonner';

const eventService = RendererEventService.instance;

function showImportWarnings(warnings: ImportWarning[]) {
  if (warnings.length === 0) return;

  const groupedWarnings = warnings.reduce<Map<string, ImportWarning[]>>((groups, warning) => {
    const group = groups.get(warning.message) ?? [];
    group.push(warning);
    groups.set(warning.message, group);
    return groups;
  }, new Map());

  const visibleGroups = [...groupedWarnings.entries()].slice(0, 3);
  const hiddenGroupCount = groupedWarnings.size - visibleGroups.length;

  toast.warning('Import incomplete', {
    description: (
      <div className="mt-1 space-y-2">
        <p>
          Collection imported, but {warnings.length} item(s) were skipped because Trufos can only
          import supported HTTP requests.
        </p>
        <div className="space-y-1">
          {visibleGroups.map(([message, group]) => {
            const visibleItems = group
              .slice(0, 2)
              .map((warning) => warning.filePath ?? warning.itemName ?? 'Unknown item')
              .join(', ');
            const hiddenItemCount = group.length - 2;

            return (
              <div key={message}>
                <div className="text-foreground font-medium">{message}</div>
                <div className="text-muted-foreground">
                  {visibleItems}
                  {hiddenItemCount > 0 ? `, +${hiddenItemCount} more` : ''}
                </div>
              </div>
            );
          })}
        </div>
        {hiddenGroupCount > 0 ? (
          <div className="text-muted-foreground">+{hiddenGroupCount} more problem type(s)</div>
        ) : null}
      </div>
    ),
  });
}

declare type ImportStrategyWithTrufos = ImportStrategy | 'Trufos';

interface TitleInputProps {
  value: string;
  onChange: (value: string) => void;
}

const TitleInput: React.FC<TitleInputProps> = ({ value, onChange }) => {
  return (
    <div className="flex flex-col gap-2">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Name of the new collection"
        className="rounded-lg"
      />
    </div>
  );
};

interface ImportTargetProps {
  targetEntry?: DroppedEntryInfo;
  onTargetEntryChange: (entry?: DroppedEntryInfo) => void;
  title: string;
  onTitleChange: (title: string) => void;
}

/** Where an imported collection is written to and its name, shown below the source. */
const ImportTarget: React.FC<ImportTargetProps> = ({
  targetEntry,
  onTargetEntryChange,
  title,
  onTitleChange,
}) => {
  return (
    <>
      {/* Flow separator */}
      <div className="flex items-center justify-center">
        <div className="bg-separator h-px flex-1" />
        <div className="border-t-separator mx-5 h-0 w-0 border-x-[6px] border-t-8 border-x-transparent" />
        <div className="bg-separator h-px flex-1" />
      </div>
      <FilePicker
        title="Select directory for new collection"
        description="This is where the imported collection will be placed"
        entry={targetEntry}
        icon={<FolderPlusIcon size={36} />}
        onFileSelected={onTargetEntryChange}
        onFileRemoved={() => onTargetEntryChange(undefined)}
        directoryMode
        controlled
      />
      <TitleInput value={title} onChange={onTitleChange} />
    </>
  );
};

const FILE_TYPE_LIST = new Intl.ListFormat('en', { type: 'disjunction' });

/** What the import dialog needs to know about an importer to show its tab. */
type ImportSourceInfo = Pick<IndexedImporter, 'name' | 'source' | 'extensions'> & {
  id: ImportStrategy;
};

interface ImportSourceProps {
  importer: ImportSourceInfo;
  srcEntry?: DroppedEntryInfo;
  onSrcEntryChange: (entry?: DroppedEntryInfo) => void;
}

/** Picks the file or directory an importer reads. */
const ImportSource: React.FC<ImportSourceProps> = ({
  importer: { name, source, extensions },
  srcEntry,
  onSrcEntryChange,
}) => {
  const isDirectory = source === 'directory';
  const fileTypes = extensions.map((extension) => `.${extension}`);
  return (
    <FilePicker
      title={
        isDirectory
          ? `Select ${name} collection directory`
          : 'Select file of the original collection'
      }
      description={
        isDirectory
          ? `Select the folder containing the ${name} collection`
          : fileTypes.length > 0
            ? `${name} exports ${FILE_TYPE_LIST.format(fileTypes)} files`
            : `Select the file exported by ${name}`
      }
      accept={!isDirectory && fileTypes.length > 0 ? fileTypes.join(',') : undefined}
      directoryMode={isDirectory}
      entry={srcEntry}
      icon={<FolderSearchIcon size={36} />}
      onFileSelected={onSrcEntryChange}
      onFileRemoved={() => onSrcEntryChange(undefined)}
      controlled
    />
  );
};

const ImportTabsContent: React.FC<{
  children: React.ReactNode;
  strategy: ImportStrategyWithTrufos;
  /** Whether to include default vertical spacing (gap) */
  gap?: boolean;
}> = ({ children, strategy, gap = true }) => {
  return (
    <TabsContent
      value={strategy}
      className="min-h-0 flex-1 overflow-auto rounded-none bg-transparent"
    >
      <div
        className={cn('flex flex-col pr-2', {
          'gap-6': gap,
        })}
      >
        {children}
      </div>
    </TabsContent>
  );
};

export const CollectionImport: React.FC<{ onClose?: () => void; open?: boolean }> = ({
  onClose,
  open = true,
}) => {
  const { changeCollection } = useCollectionActions();
  const { importers } = usePluginStore(selectPluginContributions);
  const sources: ImportSourceInfo[] = importers;

  const [strategy, setStrategy] = useState<ImportStrategyWithTrufos>('Trufos');
  const [srcEntry, setSrcEntry, resetSrcEntry] = useStateResettable<DroppedEntryInfo>();
  const [targetEntry, setTargetEntry, resetTargetEntry] = useStateResettable<DroppedEntryInfo>();
  const [title, setTitle, resetTitle] = useStateResettable('');
  const [isImporting, setIsImporting, resetIsImporting] = useStateResettable(false);

  const canImport =
    srcEntry &&
    (strategy === 'Trufos' || (targetEntry != null && title?.trim() !== '')) &&
    !isImporting;

  useEffect(() => {
    if (open) {
      resetSrcEntry();
      resetTargetEntry();
      resetTitle();
      resetIsImporting();
    }
  }, [open, strategy]);

  const doImport = useCallback(async () => {
    setIsImporting(true);
    let dirPath = srcEntry!.path;
    if (strategy !== 'Trufos') {
      try {
        const result = await eventService.importCollection(
          srcEntry!.path,
          targetEntry!.path,
          strategy,
          title!
        );
        dirPath = result.dirPath;
        showImportWarnings(result.warnings);
      } catch (e) {
        showError(e);
        setIsImporting(false);
        return;
      }
    }

    const opened = await changeCollection(dirPath);
    setIsImporting(false);
    if (opened) onClose?.();
  }, [srcEntry, targetEntry, strategy, title, onClose, changeCollection]);

  const dialogFooter = useMemo(() => {
    if (strategy === 'Insomnia') {
      return null;
    }
    return (
      <DialogFooter className="mt-2 justify-center gap-2 sm:justify-center">
        <div className="flex w-full justify-center">
          <Button onClick={doImport} disabled={!canImport} className="gap-2 font-bold">
            <Plus size={16} />
            {isImporting
              ? 'Importing...'
              : strategy === 'Trufos'
                ? 'Open Collection'
                : 'Complete Import'}
          </Button>
        </div>
      </DialogFooter>
    );
  }, [strategy, doImport, canImport, isImporting]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose?.()}>
      <DialogContent className="flex max-h-[90vh] w-[760px] max-w-3xl flex-col border-none shadow-none">
        <DialogHeader>
          <DialogTitle>Import Collection</DialogTitle>
        </DialogHeader>

        <Tabs
          value={strategy}
          onValueChange={(v) => setStrategy(v as ImportStrategy)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <TabsList className="mt-1 mb-2 ml-0.5 overflow-visible">
            <TabsTrigger value="Trufos">Trufos</TabsTrigger>
            {sources.map(({ id, name }) => (
              <TabsTrigger key={id} value={id}>
                {name}
              </TabsTrigger>
            ))}
            <TabsTrigger value="Insomnia">Insomnia</TabsTrigger>
          </TabsList>

          <ImportTabsContent strategy="Trufos">
            <FilePicker
              title="Select directory of the existing collection"
              description="Select the folder containing the collection.json file"
              entry={srcEntry}
              icon={<FolderSearchIcon size={36} />}
              onFileSelected={setSrcEntry}
              onFileRemoved={() => setSrcEntry(undefined)}
              directoryMode
              controlled
            />
          </ImportTabsContent>

          {sources.map((importer) => (
            <ImportTabsContent key={importer.id} strategy={importer.id}>
              <ImportSource
                importer={importer}
                srcEntry={srcEntry}
                onSrcEntryChange={setSrcEntry}
              />
              <ImportTarget
                targetEntry={targetEntry}
                onTargetEntryChange={setTargetEntry}
                title={title ?? ''}
                onTitleChange={setTitle}
              />
            </ImportTabsContent>
          ))}

          <ImportTabsContent strategy="Insomnia" gap={false}>
            <span>Coming soon...</span>
          </ImportTabsContent>
        </Tabs>

        {dialogFooter}
      </DialogContent>
    </Dialog>
  );
};

export default CollectionImport;
