import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDispatch } from 'react-redux';
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
import { RequestBodyType } from 'shim/http';
import { Editor } from '@monaco-editor/react';
import { DEFAULT_MONACO_OPTIONS } from '@/components/shared/settings/monaco-settings';
import { setRequestEditor } from '@/state/view';

export function InputTabs() {
  const dispatch = useDispatch();

  return (
    <Tabs defaultValue="body">
      <TabsList>
        <TabsTrigger value="body">Body</TabsTrigger>
        <TabsTrigger value="queryParams">Query</TabsTrigger>
        <TabsTrigger value="header">Header</TabsTrigger>
        <TabsTrigger value="authorization">Auth</TabsTrigger>
      </TabsList>
      <TabsContent value="body" style={{ flexDirection: 'column', display: 'flex' }}>
        <Select>
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
        <div style={{ flex: 1 }}>
          <Editor
            theme="vs-dark" /* TODO: apply theme from settings */
            options={DEFAULT_MONACO_OPTIONS}
            onMount={editor => dispatch(setRequestEditor(editor))}
          />
        </div>
      </TabsContent>
      <TabsContent value="queryParams">Change your queryParams here.</TabsContent>
      <TabsContent value="header">Change your header here.</TabsContent>
      <TabsContent value="authorization">Change your authorization here.</TabsContent>
    </Tabs>

  );
}
