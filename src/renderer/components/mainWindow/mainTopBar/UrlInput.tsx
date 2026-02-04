import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useStateDerived } from '@/util/react-util';
import { FC, useCallback } from 'react';
import { buildUrl, isUrlValid, parseUrl, TrufosURL, urlsEqual } from 'shim/objects/url';

interface UrlInputProps {
  url: TrufosURL;
  onChange: (url: TrufosURL) => void;
}

export const UrlInput: FC<UrlInputProps> = ({ url, onChange }) => {
  const [inputValue, setInputValue] = useStateDerived(url, buildUrl);
  const [isValid, setIsValid] = useStateDerived(url, isUrlValid);

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = event.target.value;
      setInputValue(newValue);
      setIsValid(URL.canParse(newValue));
      const newUrl = parseUrl(newValue);
      if (!urlsEqual(url, newUrl)) onChange(newUrl);
    },
    [url, onChange]
  );

  return (
    <Input
      value={inputValue}
      type="url"
      inputMode="url"
      className={cn('bg-background-secondary relative w-full grow rounded-l-none', {
        'border-(--error)': !isValid,
      })}
      onChange={handleChange}
    />
  );
};
