import { useMemo, useState } from 'react';
import { getMimeType, useResponseData, type ResponseRenderer } from './PrettyRenderer';

export const ImagePrettyRenderer: ResponseRenderer = ({ response }) => {
  const [data, setData] = useState<string>();
  const mimeType = useMemo(() => getMimeType(response), [response]);

  useResponseData(response, 'base64', setData);
  const src = useMemo(
    () => (data == null ? undefined : `data:${mimeType};base64,${data}`),
    [data, mimeType]
  );

  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="min-h-0 flex-1 overflow-auto">
        <img src={src} alt="Response Image" className="block w-full object-contain" />
      </div>
    </div>
  );
};
