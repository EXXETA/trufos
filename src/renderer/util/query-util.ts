import { TrufosQueryParam } from 'shim/objects/query-param';

export const getQueryParamsFromUrl = (url: string): TrufosQueryParam[] => {
  if (!url || !url.includes('?')) {
    return [];
  }

  try {
    const queryString = url.split('?')[1];
    const rawQueryString = queryString.replace(/\+/g, '%2B');
    const params = new URLSearchParams(rawQueryString);

    return Array.from(params.entries()).map(([key, value]) => ({
      key,
      value,
      isActive: true,
    }));
  } catch (error) {
    console.error('Error parsing query params from URL:', error);
    return [];
  }
};

export const areUrlsMeaningfullyDifferent = (url1: string, url2: string): boolean => {
  if (url1 === url2) return false;

  const normalizeUrl = (url: string): string => {
    if (!url) return '';

    let normalized = url.trim();

    normalized = normalized.replace(/[?&]+$/, '');

    try {
      const urlObj = new URL(normalized);
      urlObj.searchParams.sort();
      return urlObj.toString();
    } catch {
      return normalized;
    }
  };

  const normalized1 = normalizeUrl(url1);
  const normalized2 = normalizeUrl(url2);

  return normalized1 !== normalized2;
};
