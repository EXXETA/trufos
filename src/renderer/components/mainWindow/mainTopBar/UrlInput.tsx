import * as React from 'react';
import { Input } from '@/components/ui/input';

interface UrlInputProps {
  url: string;
  onUrlChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  hasError: boolean;
}

export const UrlInput: React.FC<UrlInputProps> = ({ url, onUrlChange, hasError }) => (
  <Input
    value={url}
    type="url"
    inputMode="url"
    style={{ fontFamily: 'monospace', backgroundColor: 'var(--background-secondary)' }}
    className={`rounded-l-none flex-grow w-full relative ${hasError ? 'border-[var(--error)]' : ''} bg-gray-500`}
    onChange={onUrlChange}
  />
);
