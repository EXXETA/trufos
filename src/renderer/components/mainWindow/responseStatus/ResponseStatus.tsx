import { MetaInfo } from 'shim/objects/response';
import {
  getDurationTextInSec,
  getHttpStatusColorClass,
  getHttpStatusText,
  getSizeText,
} from '@/components/mainWindow/responseStatus/ResponseStatusFormatter';
import { useSelector } from 'react-redux';
import { RootState } from '@/state/store';

export function ResponseStatus() {
  const metaInfo = useSelector<RootState, MetaInfo | null>((state) => state.requests.metaInfo);

  if (metaInfo == null) {
    return <span></span>;
  }

  const statusText = getHttpStatusText(metaInfo.status);
  const statusColorClass = getHttpStatusColorClass(metaInfo.status);
  const durationText = getDurationTextInSec(metaInfo.duration);
  const sizeText = getSizeText(metaInfo.size.totalSizeInBytes);

  return (
    <span className="response-status text-nowrap ml-auto truncate">
      <span className={'text-sm  ' + statusColorClass}>{statusText}</span>
      <span className="ml-2 text-sm">{durationText}</span>
      <span className="ml-2 text-sm tooltip">
        {sizeText}
        <div className="tooltip-text flex flex-col items-start">
          <span>Headers: {getSizeText(metaInfo.size.headersSizeInBytes)}</span>
          <span>Body: {getSizeText(metaInfo.size.bodySizeInBytes)}</span>
        </div>
      </span>
    </span>
  );
}
