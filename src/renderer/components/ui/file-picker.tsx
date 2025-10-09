import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FileDropZoneProps, DroppedEntryInfo, FileDropZone } from './file-drop-zone';
import { FileText, X } from 'lucide-react';
import { cn } from '@/lib/utils';

// We extend drop zone props except for those we manage internally or deliberately override.
export interface FilePickerProps extends Omit<FileDropZoneProps, 'children'> {
  /** Controlled entry: if provided component becomes controlled. */
  entry?: DroppedEntryInfo | null;
  /** Default entry for uncontrolled usage */
  defaultEntry?: DroppedEntryInfo | null;
  /** Called when the file is removed */
  onFileRemoved?: () => void;
  /** Size variant */
  variant?: 'default' | 'compact';
  /** Is the component controlled? */
  controlled?: boolean;
}

export const FilePicker: React.FC<FilePickerProps> = ({
  className,
  entry: controlledEntry,
  defaultEntry,
  onFileSelected: onFileSelectedCallback,
  onFileRemoved: onFileRemovedCallback,
  variant = 'default',
  controlled = false,
  ...dropZoneProps
}) => {
  const [internalEntry, setInternalEntry] = useState<DroppedEntryInfo>(defaultEntry);
  const entry = controlled ? controlledEntry : internalEntry;

  useEffect(() => {
    if (controlled && controlledEntry === null) {
      // Mirror external clearing in uncontrolled internal state for consistency when switching
      setInternalEntry(null);
    }
  }, [controlled, controlledEntry]);

  const onFileSelected = useCallback(
    (e: DroppedEntryInfo) => {
      if (!controlled) setInternalEntry(e);
      onFileSelectedCallback?.(e);
    },
    [controlled, onFileSelectedCallback]
  );

  const onFileRemoved = useCallback(() => {
    if (!controlled) setInternalEntry(null);
    onFileRemovedCallback?.();
  }, [controlled, onFileRemovedCallback]);

  const selectedNode = useMemo(() => {
    if (!entry) return null;
    return (
      <div
        className={cn('flex items-center justify-between rounded-md border p-4 text-sm', {
          'p-2': variant === 'compact',
        })}
      >
        <div className="flex items-center gap-4 overflow-hidden">
          <FileText className="shrink-0" />
          <span className="block truncate" title={entry.name}>
            {entry.name}
          </span>
        </div>
        <button
          type="button"
          className="shrink-0 text-danger transition-colors hover:opacity-80"
          onClick={onFileRemoved}
          aria-label="Remove file"
        >
          <X />
        </button>
      </div>
    );
  }, [entry, onFileRemoved, variant]);

  if (entry) {
    return <div className={className}>{selectedNode}</div>;
  } else {
    return (
      <FileDropZone className={className} onFileSelected={onFileSelected} {...dropZoneProps} />
    );
  }
};

export default FilePicker;
