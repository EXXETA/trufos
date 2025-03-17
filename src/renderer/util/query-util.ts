import { useState, useEffect } from 'react';
import { TrufosQueryParam } from '../../shim/objects/queryParams';

const safeDecode = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

export const getQueryParamsFromUrl = (url: string): { queryParams: TrufosQueryParam[] } => {
  const [queryParams, setQueryParams] = useState<TrufosQueryParam[]>([]);

  useEffect(() => {
    if (!url.includes('?')) {
      setQueryParams([]);
      return;
    }

    const queryString = url.split('?')[1];
    const rawQueryString = queryString.replace(/\+/g, '%2B');
    const params = new URLSearchParams(rawQueryString);
    const parsedParamsMap = new Map<string, string[]>();

    params.forEach((value, key) => {
      const decodedValue = safeDecode(value);
      if (parsedParamsMap.has(key)) {
        parsedParamsMap.get(key)?.push(decodedValue);
      } else {
        parsedParamsMap.set(key, [decodedValue]);
      }
    });

    const parsedParams: TrufosQueryParam[] = Array.from(parsedParamsMap.entries()).map(
      ([key, value]) => ({
        key,
        value: value.length > 1 ? value : value[0],
        isActive: true,
      })
    );

    setQueryParams(parsedParams);
  }, [url]);

  return { queryParams };
};
