import React, { useCallback, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  /** Optional custom render; receives isDragging state */
  children?: (ctx: { isDragging: boolean }) => React.ReactNode;
  /** Text shown when no custom children provided */
  placeholder?: string;
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

export const FileDropZone: React.FC<FileDropZoneProps> = ({
  className,
  onFileSelected: onFileSelectedCallback,
  disabled,
  children,
  placeholder,
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

  const onClick = useCallback(() => {
    if (disabled) return;
    inputRef.current?.click();
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

  const resolvedPlaceholder =
    placeholder ?? (directoryMode ? 'Drag & drop a folder here' : 'Drag & drop a file here');

  return (
    <div
      className={cn(
        'flex h-full w-full cursor-pointer flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed p-4 text-center text-sm transition-colors',
        isDragging && 'border-primary',
        disabled && 'pointer-events-none opacity-60',
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
      {children ? (
        children({ isDragging })
      ) : (
        <>
          <Upload size={36} />
          <span>{resolvedPlaceholder}</span>
        </>
      )}
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
    </div>
  );
};

export default FileDropZone;
