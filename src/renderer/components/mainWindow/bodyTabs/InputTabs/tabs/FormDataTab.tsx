import { Button } from '@/components/ui/button';
import { AddIcon, DeleteIcon, SwapIcon } from '@/components/icons';
import { ActiveCheckbox } from '@/components/shared/ActiveCheckbox';
import { Divider } from '@/components/shared/Divider';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useCollectionActions, useCollectionStore } from '@/state/collectionStore';
import { FileBody, RequestBodyType } from 'shim/objects/request';
import FilePicker from '@/components/ui/file-picker';
import { DroppedEntryInfo } from '@/components/ui/file-drop-zone';
import { Paperclip, Type } from 'lucide-react';

export const FormDataTab = () => {
  const { addFormDataField, updateFormDataField, deleteFormDataField, setRequestBody } =
    useCollectionActions();
  const fields = useCollectionStore((state) => {
    const body = state.requests.get(state.selectedRequestId)?.body;
    return body?.type === RequestBodyType.FORM_DATA ? body.fields : [];
  });

  const toggleFieldType = (index: number) => {
    const field = fields[index];
    if (field.value.type === RequestBodyType.TEXT) {
      updateFormDataField(index, { value: { type: RequestBodyType.FILE } });
    } else {
      updateFormDataField(index, { value: { type: RequestBodyType.TEXT, mimeType: 'text/plain' } });
    }
  };

  return (
    <div className="relative h-full p-4">
      <div className="absolute top-4 right-4 left-4 z-10">
        <div className="flex justify-between">
          <div className="flex items-center gap-2">
            <Button
              className="h-fit gap-1 hover:bg-transparent"
              size="sm"
              variant="ghost"
              onClick={addFormDataField}
            >
              <AddIcon />
              Add Field
            </Button>
          </div>

          <Button
            className="h-fit gap-1 hover:bg-transparent"
            size="sm"
            variant="ghost"
            onClick={() => setRequestBody({ type: RequestBodyType.FORM_DATA, fields: [] })}
            disabled={fields.length === 0}
          >
            <DeleteIcon />
            Delete All
          </Button>
        </div>

        <Divider className="mt-2" />
      </div>

      <div className="absolute top-17 right-4 bottom-4 left-4">
        <div className="pb-4">
          <Table className="w-full table-auto">
            <TableHeader>
              <TableRow>
                <TableHead className="w-auto">
                  <div className="flex items-center gap-3">
                    Name
                    <SwapIcon size={18} viewBox="9 7 15 18" />
                  </div>
                </TableHead>
                <TableHead className="w-full">
                  <div className="flex items-center gap-3">
                    Value
                    <SwapIcon size={18} viewBox="9 7 15 18" />
                  </div>
                </TableHead>
                <TableHead className="w-12">Type</TableHead>
                <TableHead className="w-16">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {fields.map((field, index) => {
                const isFileType = field.value.type === RequestBodyType.FILE;
                const fileValue = isFileType ? (field.value as FileBody) : null;
                return (
                  <TableRow key={index}>
                    <TableCell className="w-1/3 break-all">
                      <input
                        type="text"
                        value={field.key}
                        onChange={(e) => updateFormDataField(index, { key: e.target.value })}
                        className="w-full bg-transparent outline-hidden"
                        placeholder="Name"
                      />
                    </TableCell>

                    <TableCell className="w-full break-all">
                      {isFileType ? (
                        <FilePicker
                          variant="compact"
                          controlled
                          entry={
                            fileValue?.filePath
                              ? ({
                                  name: fileValue.fileName,
                                  path: fileValue.filePath,
                                  isDirectory: false,
                                } as DroppedEntryInfo)
                              : null
                          }
                          onFileSelected={(file) =>
                            updateFormDataField(index, {
                              value: {
                                type: RequestBodyType.FILE,
                                filePath: file.path,
                                fileName: file.name,
                                mimeType: file.mimeType,
                              },
                            })
                          }
                          onFileRemoved={() =>
                            updateFormDataField(index, { value: { type: RequestBodyType.FILE } })
                          }
                        />
                      ) : (
                        <input
                          type="text"
                          value={
                            field.value.type === RequestBodyType.TEXT
                              ? (field.value.text ?? '')
                              : ''
                          }
                          onChange={(e) =>
                            updateFormDataField(index, {
                              value: {
                                type: RequestBodyType.TEXT,
                                text: e.target.value,
                                mimeType: 'text/plain',
                              },
                            })
                          }
                          className="w-full bg-transparent outline-hidden"
                          placeholder="Value"
                        />
                      )}
                    </TableCell>

                    <TableCell className="w-12">
                      <div className="flex items-center justify-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-text-secondary hover:text-accent-primary h-6 w-6 hover:bg-transparent"
                          onClick={() => toggleFieldType(index)}
                          title={isFileType ? 'Switch to text' : 'Switch to file'}
                        >
                          {isFileType ? <Paperclip size={14} /> : <Type size={14} />}
                        </Button>
                      </div>
                    </TableCell>

                    <TableCell className="w-16 text-right">
                      <div className="flex items-center justify-center gap-2">
                        <ActiveCheckbox
                          checked={field.isActive}
                          onChange={(checked) => updateFormDataField(index, { isActive: checked })}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="hover:text-accent-primary active:text-accent-secondary h-6 w-6 hover:bg-transparent"
                          onClick={() => deleteFormDataField(index)}
                        >
                          <DeleteIcon />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};
