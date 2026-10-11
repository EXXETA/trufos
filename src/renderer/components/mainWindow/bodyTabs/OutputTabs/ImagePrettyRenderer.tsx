import { useMemo, useState } from 'react';
import { getMimeType, type ResponseRenderer } from './PrettyRenderer';
import { useBodyInput, useStreamData } from '@/hooks/useStreamData';

export const ImagePrettyRenderer: ResponseRenderer = ({ response }) => {
  const [data, setData] = useState<string>();
  const mimeType = useMemo(() => getMimeType(response), [response]);

  useStreamData(useBodyInput(response.id), 'base64', setData);
  const src = useMemo(
    () => (data == null ? undefined : `data:${mimeType};base64,${data}`),
    [data, mimeType]
  );

  return (
    <div className="absolute inset-0 flex min-h-0 flex-1 flex-col overflow-auto">
      <img src={src} alt="Response Image" className="block w-full object-contain" />
    </div>
  );
};
