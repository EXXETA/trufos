import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { Editor } from '@monaco-editor/react';
import { DEFAULT_MONACO_OPTIONS } from '@/components/shared/settings/monaco-settings';
import { HttpHeaders } from 'shim/headers';

export type OutputTabsProps = {
  headers?: HttpHeaders;
  body?: string;
}

const monacoOptions = {
  ...DEFAULT_MONACO_OPTIONS,
  readOnly: true,
};

/**
 * Get the mime type from the content type.
 * @param contentType The content type to get the mime type from.
 */
function getMimeType(contentType?: string) {
  if (contentType !== undefined) {
    const index = contentType.indexOf(';');
    return (index === -1 ? contentType : contentType.substring(0, index)).trim();
  }
}

/**
 * Get the content type without any encoding from the headers.
 * @param headers The headers to get the content type from.
 */
function getContentType(headers?: HttpHeaders) {
  const value = headers?.['content-type'];
  if (value !== undefined) {
    return Array.isArray(value) ? value[0] : value;
  }
}

export function OutputTabs(props: OutputTabsProps) {
  const { body, headers } = props;
  const mimeType = getMimeType(getContentType(headers));
  console.debug('Using syntax highlighting for mime type', mimeType);

  return (
    <Tabs defaultValue="body">
      <TabsList>
        <TabsTrigger value="body">Body</TabsTrigger>
        <TabsTrigger value="header">Header</TabsTrigger>
      </TabsList>
      <TabsContent value="body">
        <Editor
          value={body}
          language={mimeType}
          theme="vs-dark" /* TODO: apply theme from settings */
          options={monacoOptions}
        />
      </TabsContent>
      <TabsContent value="header">
        <table className="w-full min-w-max table-fixed text-left">
          <thead>
          <tr>
            <th>Key</th>
            <th>Value</th>
          </tr>
          </thead>
          <tbody>
          {headers && Object.keys(headers).map((key) => {
            const value = headers[key];
            const valueToDisplay = value !== undefined ? (Array.isArray(value) ? value : [value]) : '';
            return (
                <tr key={key}>
                  <td>
                    {key}
                  </td>
                  <td>
                    {(valueToDisplay as string[]).join(', ')}
                  </td>
                </tr>
            );
          })}
          </tbody>
        </table>
      </TabsContent>
    </Tabs>

  );
}
