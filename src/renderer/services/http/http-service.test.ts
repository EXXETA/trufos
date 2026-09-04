import { vi, describe, it, expect, beforeEach } from 'vitest';
import { DisplayableError } from 'shim/error/DisplayableError';
import { RequestAbortedError } from 'shim/error/RequestAbortedError';
import { TrufosRequest } from 'shim/objects/request';
import { HttpService } from './http-service';

const { mockSendRequest, mockAbortRequest } = vi.hoisted(() => ({
  mockSendRequest: vi.fn(),
  mockAbortRequest: vi.fn(),
}));

vi.mock('@/services/event/renderer-event-service', () => ({
  RendererEventService: {
    instance: { sendRequest: mockSendRequest, abortRequest: mockAbortRequest },
  },
}));

const request = { id: 'req-1' } as TrufosRequest;

describe('HttpService', () => {
  const httpService = HttpService.instance;

  beforeEach(() => {
    mockSendRequest.mockReset();
    mockAbortRequest.mockReset().mockResolvedValue(undefined);
  });

  it('returns the response of a successful request', async () => {
    // Arrange
    const response = { id: 'res-1' };
    mockSendRequest.mockResolvedValue(response);

    // Act & Assert
    await expect(httpService.sendRequest(request)).resolves.toBe(response);
  });

  it('rejects with a RequestAbortedError when the send was aborted by key', async () => {
    // Arrange: the main process reports an abort as an ordinary failure, so only the recorded
    // abort key tells it apart from a request that broke on its own.
    mockSendRequest.mockImplementation(async () => {
      await httpService.abortRequest('key-1');
      throw new Error('The request was aborted');
    });

    // Act & Assert
    await expect(httpService.sendRequest(request, 'key-1')).rejects.toBeInstanceOf(
      RequestAbortedError
    );
  });

  it('wraps a genuine failure in a DisplayableError', async () => {
    // Arrange
    mockSendRequest.mockRejectedValue(new Error('connection refused'));

    // Act & Assert
    await expect(httpService.sendRequest(request, 'key-2')).rejects.toBeInstanceOf(
      DisplayableError
    );
  });

  it('does not treat a later send under a reused key as aborted', async () => {
    // Arrange: the abort key is cleared once the send it belongs to settles.
    mockSendRequest.mockImplementationOnce(async () => {
      await httpService.abortRequest('key-3');
      throw new Error('The request was aborted');
    });
    await expect(httpService.sendRequest(request, 'key-3')).rejects.toBeInstanceOf(
      RequestAbortedError
    );

    mockSendRequest.mockRejectedValue(new Error('connection refused'));

    // Act & Assert
    await expect(httpService.sendRequest(request, 'key-3')).rejects.toBeInstanceOf(
      DisplayableError
    );
  });

  it('passes a DisplayableError through unchanged', async () => {
    // Arrange
    const error = new DisplayableError('description', 'title');
    mockSendRequest.mockRejectedValue(error);

    // Act & Assert
    await expect(httpService.sendRequest(request)).rejects.toBe(error);
  });
});
