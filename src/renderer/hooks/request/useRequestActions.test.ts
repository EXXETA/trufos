import { act, renderHook } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useSendRequest, useSaveRequest } from './useRequestActions';

const {
  mockSendRequest,
  mockSaveChanges,
  mockSaveModelContent,
  mockAddResponse,
  mockUpdateRequest,
  mockShowError,
} = vi.hoisted(() => ({
  mockSendRequest: vi.fn(),
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
  HttpService: { instance: { sendRequest: mockSendRequest } },
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
    mockAddResponse.mockClear();
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
