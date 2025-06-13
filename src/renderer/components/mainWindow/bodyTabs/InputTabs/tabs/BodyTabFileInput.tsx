import { cn } from '@/lib/utils';
import { selectRequest, useCollectionActions, useCollectionStore } from '@/state/collectionStore';
import { FileText, Upload, X } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { FileBody, RequestBodyType } from 'shim/objects/request';

interface BodyTabFileInputProps {
  className?: string;
}

export default function BodyTabFileInput({ className }: BodyTabFileInputProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { setRequestBody } = useCollectionActions();
  const requestBody = useCollectionStore((state) => selectRequest(state).body);

  const setRequestBodyFile = useCallback(
    (file?: File) => {
      if (!file) return;

      setRequestBody({
        type: RequestBodyType.FILE,
        filePath: window.electron.getAbsoluteFilePath(file),
        fileName: file.name,
        mimeType: file.type === '' ? undefined : file.type,
      });
    },
    [setRequestBody]
  );

  const removeRequestBodyFile = useCallback(() => {
    setRequestBody({ type: RequestBodyType.FILE });
  }, [setRequestBody]);

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!isDragging) {
        setIsDragging(true);
      }
    },
    [isDragging]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      setRequestBodyFile(e.dataTransfer.files?.[0]);
    },
    [setRequestBodyFile]
  );

  const renderSelectedFile = useCallback(
    (requestBody: FileBody) => {
      return (
        <div className="flex items-center justify-between rounded-md border p-4">
          <div className="flex items-center gap-4 overflow-hidden">
            <FileText className="flex-shrink-0" />
            <span className="block truncate">{requestBody.fileName}</span>
          </div>
          <button
            className="flex-shrink-0 text-red-500 hover:text-red-700"
            onClick={removeRequestBodyFile}
          >
            <X />
          </button>
        </div>
      );
    },
    [removeRequestBodyFile]
  );

  const renderFileDropZone = useCallback(() => {
    return (
      <div
        className={cn(
          'flex h-full w-full flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed',
          { 'border-primary': isDragging }
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload size={36} />
        <span>Drag and drop a file here, or click to select a file</span>
        <input
          type="file"
          hidden
          ref={fileInputRef}
          onChange={(e) => {
            setRequestBodyFile(e.target.files[0]);
          }}
        />
      </div>
    );
  }, [isDragging, fileInputRef, setRequestBodyFile, handleDragOver, handleDragLeave, handleDrop]);

  const isFileSelected = requestBody.type === RequestBodyType.FILE && requestBody.filePath;

  return (
    <div className={cn('h-full', className)}>
      {isFileSelected ? renderSelectedFile(requestBody) : renderFileDropZone()}
    </div>
  );
}
