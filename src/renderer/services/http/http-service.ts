import { RendererEventService } from '@/services/event/renderer-event-service';
import { DisplayableError } from '@/error/DisplayableError';
import { RufusRequest } from 'shim/request';

const eventService = RendererEventService.instance;

export class HttpService {

  public static readonly instance: HttpService = new HttpService();

  /**
   * Send an HTTP request.
   * @param request The request to send.
   * @returns The response.
   * @throws {DisplayableError} If anything fails.
   */
  public async sendRequest(request: RufusRequest) {
    try {
      console.info('Sending request:', request);
      const response = await eventService.sendRequest(request);
      console.info('Received response:', response);
      return response;
    } catch (error) {
      console.error('Error during request:', error);
      let description = 'An error occurred while sending the request';
      if (error instanceof DisplayableError) {
        throw error;
      } else if (error instanceof Error) {
        if (error.message === 'invalid url') {
          description = 'The URL you entered is invalid.';
        } else if (error.message.startsWith('getaddrinfo ENOTFOUND')) {
          description = `The domain "${error.message.substring(22)}" could not be resolved`;
        }
      }
      throw new DisplayableError(description, 'Could not send Request', error);
    }
  }

}
