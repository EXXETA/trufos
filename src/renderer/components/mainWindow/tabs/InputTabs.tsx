import {Tabs, TabsContent, TabsList, TabsTrigger} from '../../ui/tabs';
import {Editor} from "@monaco-editor/react";
import {DEFAULT_MONACO_OPTIONS} from "@/components/shared/settings/monaco-settings";

export function InputTabs() {
  return (
    <Tabs defaultValue="body">
      <TabsList>
        <TabsTrigger value="body">Body</TabsTrigger>
        <TabsTrigger value="queryParams">Query</TabsTrigger>
        <TabsTrigger value="header">Header</TabsTrigger>
        <TabsTrigger value="authorization">Auth</TabsTrigger>
      </TabsList>
      <TabsContent value="body">
        <Editor
          theme="vs-dark" /* TODO: apply theme from settings */
          options={DEFAULT_MONACO_OPTIONS}
        />
      </TabsContent>
      <TabsContent value="queryParams">Change your queryParams here.</TabsContent>
      <TabsContent value="header">Change your header here.</TabsContent>
      <TabsContent value="authorization">Change your authorization here.</TabsContent>
    </Tabs>

  );
}
