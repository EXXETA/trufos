import { useResolvedString } from '@/hooks/useResolvedString';
import { SingleLineEditor } from '@/lib/monaco/SingleLineEditor';
import { useStateDerived } from '@/util/react-util';
import { FC, useCallback } from 'react';
import { buildUrl, isUrlValid, parseUrl, TrufosURL, urlsEqual } from 'shim/objects/url';

interface UrlInputProps {
  url: TrufosURL;
  onChange: (url: TrufosURL) => void;
}

export const UrlInput: FC<UrlInputProps> = ({ url, onChange }) => {
  const [inputValue, setInputValue] = useStateDerived(url, buildUrl);
  const resolvedUrl = useResolvedString(inputValue);

  // while the variables are being resolved, the URL is assumed to be valid to avoid flickering
  const isValid = resolvedUrl === undefined || isUrlValid(resolvedUrl);

  const handleChange = useCallback(
    (newValue: string) => {
      setInputValue(newValue);
      const newUrl = parseUrl(newValue);
      if (!urlsEqual(url, newUrl)) onChange(newUrl);
    },
    [url, onChange]
  );

  return (
    <SingleLineEditor
      value={inputValue}
      invalid={!isValid}
      ariaLabel="URL"
      className="bg-background-secondary relative w-full grow rounded-l-none"
      onChange={handleChange}
    />
  );
};
