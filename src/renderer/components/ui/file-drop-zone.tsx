import React, { useCallback, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FileDropZoneProps {
  className?: string;
  onFileSelected: (file: File) => void;
  disabled?: boolean;
  /** Optional custom render; receives isDragging state */
  children?: (ctx: { isDragging: boolean }) => React.ReactNode;
  /** Text shown when no custom children provided */
  placeholder?: string;
  /** Accept attribute forwarded to input */
  accept?: string;
  /** Allow selecting multiple files (only first is passed to onFileSelected by default) */
  multiple?: boolean;
}

export const FileDropZone: React.FC<FileDropZoneProps> = ({
  className,
  onFileSelected,
  disabled,
  children,
  placeholder = 'Drag and drop a file here, or click to select a file',
  accept,
  multiple,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      const file = fileList[0];
      if (file && !disabled) {
        onFileSelected(file);
      }
    },
    [onFileSelected, disabled]
  );

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

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (disabled) return;
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles, disabled]
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
          <span>{placeholder}</span>
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        hidden
        onChange={(e) => handleFiles(e.target.files)}
        accept={accept}
        multiple={multiple}
      />
    </div>
  );
};

export default FileDropZone;
