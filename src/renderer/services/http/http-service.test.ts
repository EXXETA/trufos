import { vi, describe, it, expect, beforeEach } from 'vitest';
import { DisplayableError } from 'shim/error/DisplayableError';
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
    mockSendRequest.mockReset().mockResolvedValue({ id: 'res-1' });
    mockAbortRequest.mockReset().mockResolvedValue(undefined);
  });

  it('returns the response of a successful request', async () => {
    // Arrange
    const response = { id: 'res-1' };
    mockSendRequest.mockResolvedValue(response);

    // Act & Assert
    await expect(httpService.sendRequest(request)).resolves.toBe(response);
  });

  it('does not send a request whose signal is already aborted', async () => {
    // Arrange
    const controller = new AbortController();
    controller.abort();

    // Act
    const response = await httpService.sendRequest(request, controller.signal);

    // Assert
    expect(response).toBeNull();
    expect(mockSendRequest).not.toHaveBeenCalled();
  });

  it('aborts the in-flight request by key when the signal is aborted', async () => {
    // Arrange
    const controller = new AbortController();
    let abortKey: string | undefined;
    mockSendRequest.mockImplementation((_request: unknown, key: string) => {
      abortKey = key;
      controller.abort();
      return Promise.resolve(null);
    });

    // Act
    const response = await httpService.sendRequest(request, controller.signal);

    // Assert
    expect(abortKey).toBeTypeOf('string');
    expect(mockAbortRequest).toHaveBeenCalledWith(abortKey);
    expect(response).toBeNull();
  });

  it('mints a fresh abort key per request', async () => {
    // Act
    await httpService.sendRequest(request, new AbortController().signal);
    await httpService.sendRequest(request, new AbortController().signal);

    // Assert
    const [[, first], [, second]] = mockSendRequest.mock.calls;
    expect(first).not.toBe(second);
  });

  it('stops listening to the signal once the request settled', async () => {
    // Arrange
    const controller = new AbortController();
    await httpService.sendRequest(request, controller.signal);

    // Act: aborting a request that already settled must not reach the main process.
    controller.abort();

    // Assert
    expect(mockAbortRequest).not.toHaveBeenCalled();
  });

  it('wraps a genuine failure in a DisplayableError', async () => {
    // Arrange
    mockSendRequest.mockRejectedValue(new Error('connection refused'));

    // Act & Assert
    await expect(
      httpService.sendRequest(request, new AbortController().signal)
    ).rejects.toBeInstanceOf(DisplayableError);
  });

  it('passes a DisplayableError through unchanged', async () => {
    // Arrange
    const error = new DisplayableError('description', 'title');
    mockSendRequest.mockRejectedValue(error);

    // Act & Assert
    await expect(httpService.sendRequest(request)).rejects.toBe(error);
  });
});
