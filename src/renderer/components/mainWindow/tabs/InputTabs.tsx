import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDispatch, useSelector } from 'react-redux';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Separator } from '@radix-ui/react-select';
import { RequestBody, RequestBodyType } from 'shim/http';
import { DEFAULT_MONACO_OPTIONS } from '@/components/shared/settings/monaco-settings';
import { setRequestBody, setRequestEditor } from '@/state/view';
import { Editor } from '@monaco-editor/react';
import { Input } from '@/components/ui/input';
import { RootState } from '@/state/store';

export function InputTabs() {
  const dispatch = useDispatch();
  const requestBody = useSelector<RootState>(state => state.view.requestBody) as RequestBody | undefined;

  const renderEditor = () => {
    return (
      <Editor
        theme="vs-dark" /* TODO: apply theme from settings */
        options={DEFAULT_MONACO_OPTIONS}
        onMount={editor => dispatch(setRequestEditor(editor))}
      />
    );
  };

  const renderFileInput = () => {
    return (
      <Input
        onChange={(v) => dispatch(setRequestBody({
          type: RequestBodyType.FILE,
          filePath: v.target.files[0]?.path
        }))}
        placeholder="Select a file" type="file"
      />
    );
  };

  const changeBodyType = (type: RequestBodyType) => {
    switch (type) {
      case RequestBodyType.TEXT:
        dispatch(setRequestBody({ type, mimeType: 'text/plain' }));
        break;
      case RequestBodyType.FILE:
        dispatch(setRequestBody({ type }));
        break;
    }
  };

  return (
    <Tabs defaultValue="body">
      <TabsList>
        <TabsTrigger value="body">Body</TabsTrigger>
        <TabsTrigger value="queryParams">Query</TabsTrigger>
        <TabsTrigger value="header">Header</TabsTrigger>
        <TabsTrigger value="authorization">Auth</TabsTrigger>
      </TabsList>
      <TabsContent value="body" style={{ flexDirection: 'column', display: 'flex' }}>
        <Select onValueChange={bodyType => changeBodyType(bodyType as RequestBodyType)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Source</SelectLabel>
              <SelectItem value={RequestBodyType.TEXT}>Text</SelectItem>
              <SelectItem value={RequestBodyType.FILE}>File</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        <Separator />
        <div className="flex-1">
          {requestBody?.type === RequestBodyType.FILE ? renderFileInput() : renderEditor()}
        </div>
      </TabsContent>
      <TabsContent value="queryParams">Change your queryParams here.</TabsContent>
      <TabsContent value="header">Change your header here.</TabsContent>
      <TabsContent value="authorization">Change your authorization here.</TabsContent>
    </Tabs>

  );
}
