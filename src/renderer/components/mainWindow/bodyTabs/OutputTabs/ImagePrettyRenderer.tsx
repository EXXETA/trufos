import { useMemo, useState } from 'react';
import { getMimeType, useResponseData, type ResponseRenderer } from './PrettyRenderer';

export const ImagePrettyRenderer: ResponseRenderer = ({ response }) => {
  const [data, setData] = useState<string>();
  const mimeType = useMemo(() => getMimeType(response), [response]);

  useResponseData(response, 'base64', setData);
  const src = useMemo(() => `data:${mimeType};base64,${data}`, [data, mimeType]);

  return <img src={src} alt="Response Image" className="max-h-full max-w-full" />;
};
