import { RendererEventService } from '@/services/event/renderer-event-service';
import { DisplayableError } from 'shim/error/DisplayableError';
import { TrufosRequest } from 'shim/objects/request';
import { TrufosResponse } from 'shim/objects/response';

const eventService = RendererEventService.instance;

export class HttpService {
  public static readonly instance: HttpService = new HttpService();

  /**
   * Send an HTTP request.
   * @param request The request to send.
   * @param signal Aborting this signal cancels the request. Only a request sent with one can be
   * cancelled, and only such a request can end without a response.
   * @returns The response, or `null` if the request was aborted before one arrived.
   * @throws {DisplayableError} If anything fails.
   */
  public async sendRequest(
    request: TrufosRequest,
    signal?: AbortSignal
  ): Promise<TrufosResponse | null> {
    if (signal?.aborted) return null;

    // An AbortSignal cannot cross the IPC boundary, so the main process identifies the request to
    // abort by a key instead — a detail of the IPC hop this service owns.
    const abortKey = signal && crypto.randomUUID();
    const abort = () => void eventService.abortRequest(abortKey!).catch(console.error);
    signal?.addEventListener('abort', abort, { once: true });

    try {
      console.info('Sending request:', request);
      const response = await eventService.sendRequest(request, abortKey);
      if (response == null) {
        console.info('Request was aborted:', request.id);
      } else {
        console.info('Received response:', response);
      }
      return response;
    } catch (error) {
      console.error('Error during request:', error);
      if (error instanceof DisplayableError) {
        throw error;
      }
      throw new DisplayableError(
        'An unexpected error occurred while sending the request.',
        'Could not send Request',
        error
      );
    } finally {
      signal?.removeEventListener('abort', abort);
    }
  }
}
