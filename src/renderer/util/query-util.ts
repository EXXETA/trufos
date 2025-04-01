import { useState, useEffect } from 'react';
import { TrufosQueryParam } from 'shim/objects/query-param';

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

    const parsedParams: TrufosQueryParam[] = Array.from(params.entries()).map(([key, value]) => ({
      key,
      value,
      isActive: true,
    }));

    setQueryParams(parsedParams);
  }, [url]);

  return { queryParams };
};
