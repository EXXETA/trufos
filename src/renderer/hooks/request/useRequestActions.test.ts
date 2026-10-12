import { act, renderHook } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useSendRequest, useSaveRequest } from './useRequestActions';

const { mockSendRequest, mockSaveRequest, mockFlushModelEdits, mockAddResponse, mockShowError } =
  vi.hoisted(() => ({
    mockSendRequest: vi.fn(),
    mockSaveRequest: vi.fn(),
    mockFlushModelEdits: vi.fn(),
    mockAddResponse: vi.fn(),
    mockShowError: vi.fn(),
  }));

let mockCurrentRequest: { id: string; draft?: boolean } | undefined;

vi.mock('@/lib/monaco/models', () => ({
  flushModelEdits: mockFlushModelEdits,
}));

vi.mock('@/services/http/http-service', () => ({
  HttpService: { instance: { sendRequest: mockSendRequest } },
}));

vi.mock('@/error/errorHandler', () => ({
  showError: mockShowError,
}));

vi.mock('@/state/collectionStore', () => ({
  useCollectionStore: <T>(selector: (state: unknown) => T) => selector({}),
  useCollectionActions: () => ({ saveRequest: mockSaveRequest }),
  selectRequest: () => mockCurrentRequest,
}));

vi.mock('@/state/responseStore', () => ({
  useResponseActions: () => ({ addResponse: mockAddResponse }),
}));

describe('useSendRequest', () => {
  beforeEach(() => {
    mockCurrentRequest = { id: 'req-1' };
    mockSendRequest.mockClear();
    mockFlushModelEdits.mockClear().mockResolvedValue(undefined);
    mockAddResponse.mockClear();
    mockShowError.mockClear();
  });

  it('shares isSending across every hook instance, not just the caller that triggered it', async () => {
    const a = renderHook(() => useSendRequest());
    const b = renderHook(() => useSendRequest());

    let resolveSend!: (value: unknown) => void;
    mockSendRequest.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSend = resolve;
        })
    );

    expect(a.result.current.isSending).toBe(false);
    expect(b.result.current.isSending).toBe(false);

    let sendPromise!: Promise<void>;
    act(() => {
      sendPromise = a.result.current.sendRequest();
    });

    // The send was triggered on `a`'s instance, but `b` — a completely separate hook call —
    // must observe the same in-flight fact.
    expect(a.result.current.isSending).toBe(true);
    expect(b.result.current.isSending).toBe(true);

    // Flush the microtask queue so the hook's internal `await flushModelEdits()` resolves and
    // execution reaches `httpService.sendRequest` — only then is
    // `resolveSend` actually assigned by the mocked implementation above.
    await act(async () => {
      await Promise.resolve();
    });

    resolveSend({});
    await act(async () => {
      await sendPromise;
    });

    expect(a.result.current.isSending).toBe(false);
    expect(b.result.current.isSending).toBe(false);
  });

  it('cancels the in-flight send by aborting the signal it was sent with', async () => {
    const { result } = renderHook(() => useSendRequest());

    let resolveSend!: (value: unknown) => void;
    mockSendRequest.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSend = resolve;
        })
    );

    let sendPromise!: Promise<void>;
    act(() => {
      sendPromise = result.current.sendRequest();
    });
    await act(async () => {
      await Promise.resolve();
    });

    const signal = mockSendRequest.mock.calls[0][1] as AbortSignal;
    expect(signal.aborted).toBe(false);

    act(() => result.current.cancelRequest());
    expect(signal.aborted).toBe(true);

    // An aborted send has no response, which is the user's own doing rather than a failure: no
    // response is stored and no error toast is shown.
    resolveSend(null);
    await act(async () => {
      await sendPromise;
    });

    expect(mockShowError).not.toHaveBeenCalled();
    expect(mockAddResponse).not.toHaveBeenCalled();
    expect(result.current.isSending).toBe(false);
  });

  it('hands an already aborted signal to the send when cancelled during the editor flush', async () => {
    const { result } = renderHook(() => useSendRequest());

    // Hold the hook inside the Monaco flush that precedes the send. The button already reads
    // "Cancel" at this point, so a cancel here has to take effect — the HTTP service turns the
    // aborted signal into a request that never leaves the renderer.
    let finishFlush!: () => void;
    mockFlushModelEdits.mockReturnValue(
      new Promise<void>((resolve) => {
        finishFlush = resolve;
      })
    );

    let abortedWhenSent: boolean | undefined;
    mockSendRequest.mockImplementation((_requestId: string, signal: AbortSignal) => {
      abortedWhenSent = signal.aborted;
      return Promise.resolve(null);
    });

    let sendPromise!: Promise<void>;
    act(() => {
      sendPromise = result.current.sendRequest();
    });
    expect(result.current.isSending).toBe(true);

    act(() => result.current.cancelRequest());
    finishFlush();
    await act(async () => {
      await sendPromise;
    });

    expect(abortedWhenSent).toBe(true);
    expect(mockAddResponse).not.toHaveBeenCalled();
    expect(mockShowError).not.toHaveBeenCalled();
    expect(result.current.isSending).toBe(false);
  });

  it('still reports a genuine failure of the send', async () => {
    const { result } = renderHook(() => useSendRequest());

    const failure = new Error('connection refused');
    mockSendRequest.mockRejectedValue(failure);

    await act(async () => {
      await result.current.sendRequest();
    });

    expect(mockShowError).toHaveBeenCalledWith(failure);
    expect(result.current.isSending).toBe(false);
  });

  it('does not start a second send while one is still in flight', async () => {
    const { result } = renderHook(() => useSendRequest());

    let resolveSend!: (value: unknown) => void;
    mockSendRequest.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSend = resolve;
        })
    );

    let sendPromise!: Promise<void>;
    act(() => {
      sendPromise = result.current.sendRequest();
    });
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      await result.current.sendRequest();
    });
    expect(mockSendRequest).toHaveBeenCalledTimes(1);

    resolveSend({});
    await act(async () => {
      await sendPromise;
    });
  });

  it('flushes the editor changes before sending the request by its ID', async () => {
    const { result } = renderHook(() => useSendRequest());
    const response = { id: 'res-1' };
    mockSendRequest.mockResolvedValue(response);

    await act(async () => {
      await result.current.sendRequest();
    });

    expect(mockFlushModelEdits.mock.invocationCallOrder[0]).toBeLessThan(
      mockSendRequest.mock.invocationCallOrder[0]
    );
    expect(mockSendRequest).toHaveBeenCalledWith('req-1', expect.any(AbortSignal));
    expect(mockAddResponse).toHaveBeenCalledWith('req-1', response);
  });

  it('ignores a cancel when nothing is in flight', () => {
    const { result } = renderHook(() => useSendRequest());

    expect(() => act(() => result.current.cancelRequest())).not.toThrow();
    expect(result.current.isSending).toBe(false);
  });
});

describe('useSaveRequest', () => {
  beforeEach(() => {
    mockCurrentRequest = { id: 'req-1', draft: true };
    mockSaveRequest.mockClear();
  });

  it('saves the selected request through the store', async () => {
    mockSaveRequest.mockResolvedValue(undefined);
    const { result } = renderHook(() => useSaveRequest());

    await act(async () => {
      await result.current.saveRequest();
    });

    expect(mockSaveRequest).toHaveBeenCalledWith('req-1');
  });

  it('shares isSaving across every hook instance, not just the caller that triggered it', async () => {
    const a = renderHook(() => useSaveRequest());
    const b = renderHook(() => useSaveRequest());

    let resolveSave!: (value: unknown) => void;
    mockSaveRequest.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSave = resolve;
        })
    );

    expect(a.result.current.isSaving).toBe(false);
    expect(b.result.current.isSaving).toBe(false);

    let savePromise!: Promise<void>;
    act(() => {
      savePromise = a.result.current.saveRequest();
    });

    expect(a.result.current.isSaving).toBe(true);
    expect(b.result.current.isSaving).toBe(true);

    // Flush the microtask queue so execution reaches the store's `saveRequest` — only then is
    // `resolveSave` actually assigned by the mocked implementation above.
    await act(async () => {
      await Promise.resolve();
    });

    resolveSave(undefined);
    await act(async () => {
      await savePromise;
    });

    expect(a.result.current.isSaving).toBe(false);
    expect(b.result.current.isSaving).toBe(false);
  });
});
