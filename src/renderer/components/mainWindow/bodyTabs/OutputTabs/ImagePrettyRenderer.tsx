import { useMemo, useState } from 'react';
import { type BodyRenderer } from './body-renderer';
import { useBodyData } from '@/hooks/useBodyData';

export const ImagePrettyRenderer: BodyRenderer = ({ body, mimeType }) => {
  const [data, setData] = useState<string>();

  useBodyData(body?.id, 'base64', setData);
  const src = useMemo(
    () => (data == null ? undefined : `data:${mimeType};base64,${data}`),
    [data, mimeType]
  );

  return (
    <div className="absolute inset-0 flex min-h-0 flex-1 flex-col overflow-auto">
      <img src={src} alt="Body" className="block w-full object-contain" />
    </div>
  );
};
