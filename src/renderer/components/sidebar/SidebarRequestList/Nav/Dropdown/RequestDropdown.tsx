import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarMenuAction } from '@/components/ui/sidebar';
import { handleMouseEvent } from '@/util/callback-util';
import { useCollectionActions, useCollectionStore } from '@/state/collectionStore';
import { RequestBodyType, TrufosRequest } from 'shim/objects/request';
import { cn } from '@/lib/utils';
import { MoreIcon } from '@/components/icons';
import { buildCurlCommand, resolveCurlCommandVariables } from '@/util/curl-util';
import { IpcPushStream } from '@/lib/ipc-stream';
import { toast } from '@/components/ui/sonner';
import { showError } from '@/error/errorHandler';
import { RendererEventService } from '@/services/event/renderer-event-service';

const eventService = RendererEventService.instance;

export interface RequestDropdownProps {
  request: TrufosRequest;
  onRename: () => void;
}

export const RequestDropdown = ({ request, onRename }: RequestDropdownProps) => {
  const { copyRequest, deleteRequest } = useCollectionActions();
  const selectedRequestId = useCollectionStore((state) => state.selectedRequestId);

  const copyAsCurl = async (): Promise<void> => {
    try {
      let textBody: string | undefined;
      if (request.body?.type === RequestBodyType.TEXT) {
        textBody = request.body.text;
        if (textBody == null) {
          // The body lives in a file that may not exist for never-opened requests.
          textBody = await IpcPushStream.open(request, 'utf-8')
            .then((stream) => stream.readAll())
            .catch(() => undefined);
        }
      }
      const resolved = await resolveCurlCommandVariables(
        request,
        textBody,
        eventService.setVariablesInString
      );
      await navigator.clipboard.writeText(buildCurlCommand(resolved.request, resolved.textBody));
      toast.success('cURL command copied to clipboard');
    } catch (error) {
      showError('Failed to copy cURL command', error);
    }
  };

  return (
    <div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuAction
            className={cn('h6 w-6')}
            showOnHover={selectedRequestId !== request.id}
          >
            <div className={cn('h6 w-6', 'rotate-90')}>
              <MoreIcon size={24} />
            </div>

            <span className="sr-only">More</span>
          </SidebarMenuAction>
        </DropdownMenuTrigger>

        <DropdownMenuContent className="w-48 rounded-lg" side="right" align="start">
          <DropdownMenuItem onClick={handleMouseEvent(onRename)}>Rename Request</DropdownMenuItem>

          <DropdownMenuItem onClick={handleMouseEvent(() => copyRequest(request.id))}>
            Copy Request
          </DropdownMenuItem>

          <DropdownMenuItem onClick={handleMouseEvent(() => void copyAsCurl())}>
            Copy as cURL
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={handleMouseEvent(() => deleteRequest(request.id))}
            className="text-danger"
          >
            Delete Request
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
