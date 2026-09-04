import { RendererEventService } from '@/services/event/renderer-event-service';
import { DisplayableError } from 'shim/error/DisplayableError';
import { RequestAbortedError } from 'shim/error/RequestAbortedError';
import { TrufosRequest } from 'shim/objects/request';

const eventService = RendererEventService.instance;

export class HttpService {
  public static readonly instance: HttpService = new HttpService();

  /**
   * Abort keys of the sends that {@link abortRequest} was called for and that have not settled yet.
   * The main process reports an abort as an ordinary failure, so this is what tells a deliberate
   * cancellation apart from a request that broke on its own.
   */
  private readonly abortedKeys = new Set<string>();

  /**
   * Send an HTTP request.
   * @param request The request to send.
   * @param abortKey Key under which the request can be aborted via {@link abortRequest}.
   * @returns The response.
   * @throws {RequestAbortedError} If the request was aborted via {@link abortRequest}.
   * @throws {DisplayableError} If anything else fails.
   */
  public async sendRequest(request: TrufosRequest, abortKey?: string) {
    try {
      console.info('Sending request:', request);
      const response = await eventService.sendRequest(request, abortKey);
      console.info('Received response:', response);
      return response;
    } catch (error) {
      // Cancelling is a user action, not a failure, so it is neither logged nor made displayable.
      if (abortKey != null && this.abortedKeys.has(abortKey)) {
        console.info('Request was aborted:', request.id);
        throw new RequestAbortedError();
      }

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
      if (abortKey != null) this.abortedKeys.delete(abortKey);
    }
  }

  /** Abort the in-flight request that was sent with the given abort key. */
  public async abortRequest(abortKey: string) {
    this.abortedKeys.add(abortKey);
    await eventService.abortRequest(abortKey);
  }
}
