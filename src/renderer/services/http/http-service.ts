import { RendererEventService } from '@/services/event/renderer-event-service';
import { DisplayableError } from 'shim/error/DisplayableError';
import { TrufosRequest } from 'shim/objects/request';

const eventService = RendererEventService.instance;

export class HttpService {
  public static readonly instance: HttpService = new HttpService();

  /**
   * Send an HTTP request.
   * @param request The request to send.
   * @returns The response.
   * @throws {DisplayableError} If anything fails.
   */
  public async sendRequest(request: TrufosRequest, abortKey?: string) {
    try {
      console.info('Sending request:', request);
      const response = await eventService.sendRequest(request, abortKey);
      console.info('Received response:', response);
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
    }
  }

  public async abortRequest(abortKey: string) {
    await eventService.abortRequest(abortKey);
  }
}
