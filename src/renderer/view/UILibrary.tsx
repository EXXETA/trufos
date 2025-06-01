import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import * as React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function UILibrary() {
  return (
    <div className="m-8 flex flex-col flex-wrap gap-8">
      <h1 className="self-center">Component Library</h1>
      <Button>Create New Request</Button>
      <Button variant="secondary">Send</Button>
      <Button variant="ghost">Send</Button>
      <Input value="Search for requests" type="text" inputMode="text" />
      <Select>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="JSON">JSON</SelectItem>
            <SelectItem value="HTML">HTML</SelectItem>
            <SelectItem value="XML">XML</SelectItem>
            <SelectItem value="AUTO">AUTO</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>

      <Tabs defaultValue="body">
        <TabsList>
          <TabsTrigger value="body">Tab</TabsTrigger>
          <TabsTrigger value="queryParams">Tab</TabsTrigger>
          <TabsTrigger value="header">Header</TabsTrigger>
          <TabsTrigger value="authorization">Auth</TabsTrigger>
        </TabsList>
        <TabsContent value="body" style={{ flexDirection: 'column', display: 'flex' }}>
          <p>First Tab Content</p>
        </TabsContent>
        <TabsContent value="queryParams">Change your queryParams here.</TabsContent>
        <TabsContent value="header">Change your header here.</TabsContent>
        <TabsContent value="authorization">Change your authorization here.</TabsContent>
      </Tabs>
    </div>
  );
}
