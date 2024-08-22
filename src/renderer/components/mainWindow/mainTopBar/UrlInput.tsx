import * as React from 'react';
import { Input } from '@/components/ui/input';

interface UrlInputProps {
  url: string;
  onUrlChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export const UrlInput: React.FC<UrlInputProps> = ({ url, onUrlChange }) => (
  <Input
    value={url}
    type="url"
    inputMode="url"
    style={{ fontFamily: 'monospace' }}
    className="rounded-br rounded-tr flex-grow w-full"
    onChange={onUrlChange}
  />
);
