import React, { useCallback, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RendererEventService } from '@/services/event/renderer-event-service';
import { dir } from 'console';
import { FolderSearchIcon } from '../icons';

export interface DroppedEntryInfo {
  /** Absolute path to the selected file or directory */
  path: string;
  /** Base name (file or directory) */
  name: string;
  /** True if original dropped item was (or resolved to) a directory */
  isDirectory: boolean;
  /** MIME type of the file (if known) */
  mimeType?: string;
}

export interface FileDropZoneProps {
  className?: string;
  /** Callback fired when a file or directory (represented via first contained file) is selected */
  onFileSelected: (entry: DroppedEntryInfo) => void;
  disabled?: boolean;
  title?: string;
  description?: string;
  /** Optional custom icon (component or element) rendered above the title. If not provided, a default Upload icon is shown. Recommended size is 36px */
  icon?: React.ReactNode;
  /** Accept attribute forwarded to input */
  accept?: string;
  /** Allow selecting directories */
  directoryMode?: boolean;
}

// Chromium (Electron) non-standard File System Entry typings (scoped & renamed to avoid DOM lib clashes)
interface FsEntryBaseLite {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
}
interface FsFileEntryLite extends FsEntryBaseLite {
  isFile: true;
  file(callback: (file: File) => void, errorCallback?: (err: unknown) => void): void;
}
interface FsDirectoryEntryLite extends FsEntryBaseLite {
  isDirectory: true;
  createReader(): {
    readEntries(success: (entries: FsEntryLite[]) => void, error?: (err: unknown) => void): void;
  };
}
type FsEntryLite = FsFileEntryLite | FsDirectoryEntryLite;
// We don't extend DataTransferItem strictly to avoid structural conflicts; we assert cast when needed.
interface DataTransferItemWithEntry /* not extending */ {
  kind: string;
  type: string;
  getAsFile(): File | null;
  webkitGetAsEntry(): FsEntryLite | null;
}

const eventService = RendererEventService.instance;

export const FileDropZone: React.FC<FileDropZoneProps> = ({
  className,
  onFileSelected: onFileSelectedCallback,
  disabled,
  title,
  description,
  icon,
  accept,
  directoryMode = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const onDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (disabled) return;
      if (!isDragging) setIsDragging(true);
    },
    [isDragging, disabled]
  );

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const onSelected = useCallback(
    (file: File | null | undefined, isDirectory: boolean) => {
      if (!file || disabled || directoryMode !== isDirectory) return;
      onFileSelectedCallback({
        name: file.name,
        path: window.electron.getAbsoluteFilePath(file),
        mimeType: directoryMode ? undefined : file.type,
        isDirectory: directoryMode,
      });
    },
    [directoryMode, onFileSelectedCallback]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (disabled) return;
      setIsDragging(false);

      const item = e.dataTransfer.items[0];
      if (item == null || item.kind !== 'file') {
        console.info('Dropped item was not a file');
        return;
      }

      const entry = item.webkitGetAsEntry();
      console.debug('File item was dropped:', entry);
      if (entry.isFile || entry.isDirectory) onSelected(item.getAsFile(), entry.isDirectory);
    },
    [disabled, directoryMode]
  );

  const onClick = useCallback(async () => {
    if (disabled) {
      return;
    } else if (directoryMode) {
      const result = await eventService.showOpenDialog({
        message: title,
        properties: ['openDirectory', 'createDirectory'],
      });
      if (!result.canceled && result.filePaths.length > 0) {
        onFileSelectedCallback({
          name: result.filePaths[0], // TODO: get base name from backend
          path: result.filePaths[0],
          isDirectory: true,
        });
      }
    } else {
      inputRef.current?.click();
    }
  }, [disabled]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick();
      }
    },
    [onClick]
  );

  return (
    <div
      className={cn(
        'flex h-full w-full cursor-pointer flex-col items-center justify-center gap-4 border-2 border-dashed p-4 text-center text-sm transition-colors',
        { 'border-primary': isDragging, 'pointer-events-none opacity-60': disabled },
        className
      )}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={onClick}
      onKeyDown={onKeyDown}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled || undefined}
    >
      {(icon ?? directoryMode) ? <FolderSearchIcon size={36} /> : <Upload size={36} />}
      <span className="text-text-primary inline-flex h-[17px] shrink-0 items-start text-sm leading-[1.2] font-normal whitespace-pre">
        {title ?? `Drag & drop a ${directoryMode ? 'folder' : 'file'} here`}
      </span>
      <span className="text-text-secondary inline-flex h-[15px] shrink-0 items-start text-xs leading-[1.2] font-normal whitespace-pre">
        {description ?? ''}
      </span>
      {directoryMode ? null : (
        <input
          ref={inputRef}
          type="file"
          hidden
          onChange={(e) => {
            e.preventDefault();
            onSelected(e.target.files?.[0], false);
          }}
          accept={accept}
        />
      )}
    </div>
  );
};

export default FileDropZone;
