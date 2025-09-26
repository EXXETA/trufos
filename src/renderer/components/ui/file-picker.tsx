import React, { useCallback, useEffect, useMemo, useState } from 'react';
import FileDropZone, { FileDropZoneProps, DroppedEntryInfo } from './file-drop-zone';
import { FileText, X } from 'lucide-react';
import { cn } from '@/lib/utils';

// We extend drop zone props except for those we manage internally or deliberately override.
export interface FilePickerProps extends Omit<FileDropZoneProps, 'children' | 'onFileSelected'> {
  /** Controlled entry: if provided component becomes controlled. */
  entry?: DroppedEntryInfo | null;
  /** Default entry for uncontrolled usage */
  defaultEntry?: DroppedEntryInfo | null;
  /** Called when the file is removed */
  onFileRemoved?: () => void;
  /** Optional render override for selected file row */
  renderSelected?: (args: { entry: DroppedEntryInfo; remove: () => void }) => React.ReactNode;
  /** Size variant (future expansion) */
  variant?: 'default' | 'compact';
  /** Called when an entry (file or directory) is selected */
  onFileSelected?: (entry: DroppedEntryInfo) => void;
}

export const FilePicker: React.FC<FilePickerProps> = ({
  className,
  entry: controlledEntry,
  defaultEntry = null,
  onFileSelected,
  onFileRemoved,
  renderSelected,
  variant = 'default',
  ...dropZoneProps
}) => {
  const [internalEntry, setInternalEntry] = useState<DroppedEntryInfo | null>(defaultEntry);

  const isControlled = controlledEntry !== undefined;
  const entry = isControlled ? controlledEntry : internalEntry;

  useEffect(() => {
    if (isControlled && controlledEntry === null) {
      // Mirror external clearing in uncontrolled internal state for consistency when switching
      setInternalEntry(null);
    }
  }, [isControlled, controlledEntry]);

  const selectEntry = useCallback(
    (e: DroppedEntryInfo) => {
      if (!isControlled) setInternalEntry(e);
      onFileSelected?.(e);
    },
    [isControlled, onFileSelected]
  );

  const removeEntry = useCallback(() => {
    if (!isControlled) setInternalEntry(null);
    onFileRemoved?.();
  }, [isControlled, onFileRemoved]);

  const selectedNode = useMemo(() => {
    if (!entry) return null;
    if (renderSelected) return renderSelected({ entry, remove: removeEntry });
    return (
      <div
        className={cn('flex items-center justify-between rounded-md border p-4 text-sm', {
          'p-2': variant === 'compact',
        })}
      >
        <div className="flex items-center gap-4 overflow-hidden">
          <FileText className="flex-shrink-0" />
          <span className="block truncate" title={entry.name}>
            {entry.name}
          </span>
        </div>
        <button
          type="button"
          className="flex-shrink-0 text-red-500 transition-colors hover:text-red-700"
          onClick={removeEntry}
          aria-label="Remove file"
        >
          <X />
        </button>
      </div>
    );
  }, [entry, renderSelected, removeEntry, variant]);

  if (entry) {
    return <div className={className}>{selectedNode}</div>;
  } else {
    return <FileDropZone className={className} onFileSelected={selectEntry} {...dropZoneProps} />;
  }
};

export default FilePicker;
