import { cn } from '@/lib/utils';
import { selectRequest, useCollectionActions, useCollectionStore } from '@/state/collectionStore';
import { useCallback, useMemo } from 'react';
import FilePicker from '@/components/ui/file-picker';
import { FileBody, RequestBodyType } from 'shim/objects/request';

interface BodyTabFileInputProps {
  className?: string;
}

export default function BodyTabFileInput({ className }: BodyTabFileInputProps) {
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

  const isFileSelected = requestBody.type === RequestBodyType.FILE && requestBody.filePath;

  // Derive a pseudo File object for controlled FilePicker when a file is already stored in state
  const controlledFile = useMemo(() => {
    if (!isFileSelected) return null;
    // We only have fileName + path + mimeType, so create a lightweight File-like shim if needed.
    // For display we only need name; FilePicker never reads other props beyond name.
    return { name: requestBody.fileName ?? 'Unknown file' } as File;
  }, [isFileSelected, requestBody]);

  return (
    <div className={cn('h-full', className)}>
      <FilePicker
        file={controlledFile}
        onFileSelected={(file) => setRequestBodyFile(file)}
        onFileRemoved={removeRequestBodyFile}
      />
    </div>
  );
}
