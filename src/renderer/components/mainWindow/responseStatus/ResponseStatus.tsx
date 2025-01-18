import {
  getDurationTextInSec,
  getHttpStatusColorClass,
  getHttpStatusText,
  getSizeText,
} from '@/components/mainWindow/responseStatus/ResponseStatusFormatter';
import { selectResponse, useResponseStore } from '@/state/responseStore';
import { selectRequest, useRequestStore } from '@/state/requestStore';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function ResponseStatus() {
  const requestId = useRequestStore((state) => selectRequest(state)?.id);
  const response = useResponseStore((state) => selectResponse(state, requestId));

  if (response?.metaInfo == null) {
    return <span></span>;
  }
  const { metaInfo } = response;

  const statusText = getHttpStatusText(metaInfo.status);
  const statusColorClass = getHttpStatusColorClass(metaInfo.status);
  const durationText = getDurationTextInSec(metaInfo.duration);
  const sizeText = getSizeText(metaInfo.size.totalSizeInBytes);

  return (
    <span className="response-status text-nowrap ml-auto truncate">
      <span className={'text-sm  ' + statusColorClass}>{statusText}</span>
      <span className="ml-2 text-sm">{durationText}</span>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="ml-2 text-sm">{sizeText}</span>
        </TooltipTrigger>
        <TooltipContent>
          <div className="flex flex-col items-start">
            <span>Headers: {getSizeText(metaInfo.size.headersSizeInBytes)}</span>
            <span>Body: {getSizeText(metaInfo.size.bodySizeInBytes)}</span>
          </div>
        </TooltipContent>
      </Tooltip>
    </span>
  );
}
