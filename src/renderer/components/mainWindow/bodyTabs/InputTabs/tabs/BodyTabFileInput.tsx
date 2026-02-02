import { cn } from '@/lib/utils';
import { selectRequest, useCollectionActions, useCollectionStore } from '@/state/collectionStore';
import { useCallback, useMemo } from 'react';
import FilePicker from '@/components/ui/file-picker';
import { FileBody, RequestBodyType } from 'shim/objects/request';
import { DroppedEntryInfo } from '@/components/ui/file-drop-zone';

interface BodyTabFileInputProps {
  className?: string;
}

export default function BodyTabFileInput({ className }: BodyTabFileInputProps) {
  const { setRequestBody } = useCollectionActions();
  const requestBody = useCollectionStore((state) => selectRequest(state).body);

  const setRequestBodyFile = useCallback(
    (file: DroppedEntryInfo) => {
      if (!file.isDirectory) {
        setRequestBody({
          type: RequestBodyType.FILE,
          filePath: file.path,
          fileName: file.name,
          mimeType: file.mimeType,
        });
      }
    },
    [setRequestBody]
  );

  const removeRequestBodyFile = useCallback(() => {
    setRequestBody({ type: RequestBodyType.FILE });
  }, [setRequestBody]);

  const isFileSelected = requestBody.type === RequestBodyType.FILE && requestBody.filePath;

  const file = useMemo(() => {
    if (!isFileSelected) return null;
    return {
      name: requestBody.fileName,
      path: requestBody.filePath,
      isDirectory: false,
    } as DroppedEntryInfo;
  }, [isFileSelected, requestBody]);

  return (
    <div className={cn('h-full', className)}>
      <FilePicker
        entry={file}
        controlled={true}
        onFileSelected={(file) => setRequestBodyFile(file)}
        onFileRemoved={removeRequestBodyFile}
      />
    </div>
  );
}
