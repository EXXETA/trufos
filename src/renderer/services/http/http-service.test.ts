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

  it('returns null for an aborted request instead of failing', async () => {
    // Arrange
    mockSendRequest.mockResolvedValue(null);

    // Act & Assert
    await expect(httpService.sendRequest(request, 'key-1')).resolves.toBeNull();
  });

  it('wraps a genuine failure in a DisplayableError', async () => {
    // Arrange
    mockSendRequest.mockRejectedValue(new Error('connection refused'));

    // Act & Assert
    await expect(httpService.sendRequest(request, 'key-2')).rejects.toBeInstanceOf(
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

  it('forwards the abort key to the event service', async () => {
    // Act
    await httpService.abortRequest('key-3');

    // Assert
    expect(mockAbortRequest).toHaveBeenCalledWith('key-3');
  });
});
