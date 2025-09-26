import React, { useCallback, useEffect, useMemo, useState } from 'react';
import FileDropZone, { FileDropZoneProps } from './file-drop-zone';
import { FileText, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FilePickerProps {
  className?: string;
  /** Controlled file: if provided component becomes controlled. */
  file?: File | null;
  /** Default file for uncontrolled usage */
  defaultFile?: File | null;
  /** Called when a file is selected */
  onFileSelected?: (file: File) => void;
  /** Called when the file is removed */
  onFileRemoved?: () => void;
  /** Disable interaction */
  disabled?: boolean;
  /** Accept attribute for input */
  accept?: string;
  /** Allow multiple selection (only first persisted unless handled externally) */
  multiple?: boolean;
  /** Placeholder / empty state text (used when no custom children) */
  placeholder?: string;
  /** Optional render override for selected file row */
  renderSelected?: (args: { file: File; remove: () => void }) => React.ReactNode;
  /** Size variant (future expansion) */
  variant?: 'default' | 'compact';
  /** Additional drop zone props override */
  dropZoneProps?: Partial<Omit<FileDropZoneProps, 'onFileSelected'>>;
}

export const FilePicker: React.FC<FilePickerProps> = ({
  className,
  file: controlledFile,
  defaultFile = null,
  onFileSelected,
  onFileRemoved,
  disabled,
  accept,
  multiple,
  placeholder,
  renderSelected,
  variant = 'default',
  dropZoneProps,
}) => {
  const [internalFile, setInternalFile] = useState<File | null>(defaultFile);

  const isControlled = controlledFile !== undefined;
  const file = isControlled ? controlledFile : internalFile;

  useEffect(() => {
    if (isControlled && controlledFile === null) {
      // Mirror external clearing in uncontrolled internal state for consistency when switching
      setInternalFile(null);
    }
  }, [isControlled, controlledFile]);

  const selectFile = useCallback(
    (f: File) => {
      if (!isControlled) setInternalFile(f);
      onFileSelected?.(f);
    },
    [isControlled, onFileSelected]
  );

  const removeFile = useCallback(() => {
    if (!isControlled) setInternalFile(null);
    onFileRemoved?.();
  }, [isControlled, onFileRemoved]);

  const selectedNode = useMemo(() => {
    if (!file) return null;
    if (renderSelected) return renderSelected({ file, remove: removeFile });
    return (
      <div
        className={cn('flex items-center justify-between rounded-md border p-4 text-sm', {
          'p-2': variant === 'compact',
        })}
      >
        <div className="flex items-center gap-4 overflow-hidden">
          <FileText className="flex-shrink-0" />
          <span className="block truncate" title={file.name}>
            {file.name}
          </span>
        </div>
        <button
          type="button"
          className="flex-shrink-0 text-red-500 transition-colors hover:text-red-700"
          onClick={removeFile}
          aria-label="Remove file"
        >
          <X />
        </button>
      </div>
    );
  }, [file, renderSelected, removeFile, variant]);

  if (file) {
    return <div className={className}>{selectedNode}</div>;
  } else {
    return (
      <FileDropZone
        className={className}
        onFileSelected={selectFile}
        disabled={disabled}
        accept={accept}
        multiple={multiple}
        placeholder={placeholder}
        {...dropZoneProps}
      />
    );
  }
};

export default FilePicker;
