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
    className={`relative w-full grow rounded-l-none ${hasError ? 'border-(--error)' : ''} bg-background-secondary font-mono`}
    onChange={onUrlChange}
  />
);
