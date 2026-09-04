import { act, renderHook } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useSendRequest, useSaveRequest } from './useRequestActions';

const {
  mockSendRequest,
  mockAbortRequest,
  mockSaveChanges,
  mockSaveModelContent,
  mockAddResponse,
  mockUpdateRequest,
  mockShowError,
} = vi.hoisted(() => ({
  mockSendRequest: vi.fn(),
  mockAbortRequest: vi.fn(),
  mockSaveChanges: vi.fn(),
  mockSaveModelContent: vi.fn(),
  mockAddResponse: vi.fn(),
  mockUpdateRequest: vi.fn(),
  mockShowError: vi.fn(),
}));

let mockCurrentRequest: { id: string; draft?: boolean } | undefined;

vi.mock('monaco-editor', () => ({
  editor: { getModels: () => [] },
}));

vi.mock('@/lib/monaco/models', () => ({
  saveModelContent: mockSaveModelContent,
}));

vi.mock('@/services/http/http-service', () => ({
  HttpService: { instance: { sendRequest: mockSendRequest, abortRequest: mockAbortRequest } },
}));

vi.mock('@/services/event/renderer-event-service', () => ({
  RendererEventService: { instance: { saveChanges: mockSaveChanges } },
}));

vi.mock('@/error/errorHandler', () => ({
  showError: mockShowError,
}));

vi.mock('@/state/collectionStore', () => ({
  useCollectionStore: <T>(selector: (state: unknown) => T) => selector({}),
  useCollectionActions: () => ({ updateRequest: mockUpdateRequest }),
  selectRequest: () => mockCurrentRequest,
}));

vi.mock('@/state/responseStore', () => ({
  useResponseActions: () => ({ addResponse: mockAddResponse }),
}));

describe('useSendRequest', () => {
  beforeEach(() => {
    mockCurrentRequest = { id: 'req-1' };
    mockSendRequest.mockClear();
    mockAbortRequest.mockClear().mockResolvedValue(undefined);
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

    // Flush the microtask queue so the hook's internal `await Promise.all([])` (flushing zero
    // Monaco models) resolves and execution reaches `httpService.sendRequest` — only then is
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

  it('cancels the in-flight send with the abort key it was sent with', async () => {
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

    const abortKey = mockSendRequest.mock.calls[0][1];
    expect(abortKey).toBeTypeOf('string');

    act(() => result.current.cancelRequest());
    expect(mockAbortRequest).toHaveBeenCalledWith(abortKey);

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

  it('ignores a cancel when nothing is in flight', () => {
    const { result } = renderHook(() => useSendRequest());

    act(() => result.current.cancelRequest());

    expect(mockAbortRequest).not.toHaveBeenCalled();
  });
});

describe('useSaveRequest', () => {
  beforeEach(() => {
    mockCurrentRequest = { id: 'req-1', draft: true };
    mockSaveChanges.mockClear();
    mockUpdateRequest.mockClear();
  });

  it('shares isSaving across every hook instance, not just the caller that triggered it', async () => {
    const a = renderHook(() => useSaveRequest());
    const b = renderHook(() => useSaveRequest());

    let resolveSave!: (value: unknown) => void;
    mockSaveChanges.mockImplementation(
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

    // Flush the microtask queue so the hook's internal `await Promise.all([])` (flushing zero
    // Monaco models) resolves and execution reaches `eventService.saveChanges` — only then is
    // `resolveSave` actually assigned by the mocked implementation above.
    await act(async () => {
      await Promise.resolve();
    });

    resolveSave({ id: 'req-1' });
    await act(async () => {
      await savePromise;
    });

    expect(a.result.current.isSaving).toBe(false);
    expect(b.result.current.isSaving).toBe(false);
  });
});
