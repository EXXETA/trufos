import { renderHook, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const resolveVariablesInString = vi.fn<(string: string) => Promise<string | null>>();

// the mocks are hoisted, so they must not dereference the variables above before the tests run
vi.mock('@/services/event/renderer-event-service', () => ({
  RendererEventService: {
    instance: { resolveVariablesInString: (string: string) => resolveVariablesInString(string) },
  },
}));

const collectionState = {
  collection: {
    variables: {} as Record<string, unknown>,
    environments: {} as Record<string, { variables: Record<string, unknown> }>,
  },
  selectedEnvironmentKey: undefined as string | undefined,
};
vi.mock('@/state/collectionStore', () => ({
  useCollectionStore: (selector: (state: typeof collectionState) => unknown) =>
    selector(collectionState),
}));

import { useResolvedString } from './useResolvedString';

describe('useResolvedString', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    collectionState.collection.variables = {};
    collectionState.collection.environments = {};
    collectionState.selectedEnvironmentKey = undefined;
  });

  it('should return the resolved string', async () => {
    // Arrange
    resolveVariablesInString.mockResolvedValue('https://example.com/users');

    // Act
    const { result } = renderHook(() => useResolvedString('{{ baseUrl }}/users'));

    // Assert
    expect(result.current).toBeUndefined(); // still pending
    await waitFor(() => expect(result.current).toBe('https://example.com/users'));
    expect(resolveVariablesInString).toHaveBeenCalledWith('{{ baseUrl }}/users');
  });

  it('should return null when a variable is not defined', async () => {
    // Arrange
    resolveVariablesInString.mockResolvedValue(null);

    // Act
    const { result } = renderHook(() => useResolvedString('{{ missing }}'));

    // Assert
    await waitFor(() => expect(result.current).toBeNull());
  });

  it('should stay pending when the resolution fails', async () => {
    // Arrange
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    resolveVariablesInString.mockRejectedValue(new Error('IPC is broken'));

    // Act
    const { result } = renderHook(() => useResolvedString('{{ baseUrl }}'));

    // Assert
    await waitFor(() => expect(consoleError).toHaveBeenCalled());
    expect(result.current).toBeUndefined();
  });

  it('should resolve again when the string changes', async () => {
    // Arrange
    resolveVariablesInString.mockResolvedValue('first');
    const { result, rerender } = renderHook(({ string }) => useResolvedString(string), {
      initialProps: { string: 'a' },
    });
    await waitFor(() => expect(result.current).toBe('first'));

    // Act
    resolveVariablesInString.mockResolvedValue('second');
    rerender({ string: 'b' });

    // Assert
    await waitFor(() => expect(result.current).toBe('second'));
    expect(resolveVariablesInString).toHaveBeenCalledTimes(2);
  });

  it('should resolve again when the collection variables change', async () => {
    // Arrange
    resolveVariablesInString.mockResolvedValue('first');
    const { result, rerender } = renderHook(() => useResolvedString('{{ baseUrl }}'));
    await waitFor(() => expect(result.current).toBe('first'));

    // Act
    collectionState.collection.variables = { baseUrl: { value: 'https://example.com' } };
    resolveVariablesInString.mockResolvedValue('second');
    rerender();

    // Assert
    await waitFor(() => expect(result.current).toBe('second'));
  });

  it('should resolve again when another environment is selected', async () => {
    // Arrange
    collectionState.collection.environments = { dev: { variables: {} }, prod: { variables: {} } };
    collectionState.selectedEnvironmentKey = 'dev';
    resolveVariablesInString.mockResolvedValue('first');
    const { result, rerender } = renderHook(() => useResolvedString('{{ baseUrl }}'));
    await waitFor(() => expect(result.current).toBe('first'));

    // Act
    collectionState.selectedEnvironmentKey = 'prod';
    resolveVariablesInString.mockResolvedValue('second');
    rerender();

    // Assert
    await waitFor(() => expect(result.current).toBe('second'));
  });

  it('should ignore the result of an outdated resolution', async () => {
    // Arrange: the first resolution finishes after the second one
    let resolveFirst!: (value: string) => void;
    resolveVariablesInString.mockReturnValueOnce(
      new Promise((resolve) => (resolveFirst = resolve))
    );
    resolveVariablesInString.mockResolvedValueOnce('second');
    const { result, rerender } = renderHook(({ string }) => useResolvedString(string), {
      initialProps: { string: 'a' },
    });

    // Act
    rerender({ string: 'b' });
    await waitFor(() => expect(result.current).toBe('second'));
    resolveFirst('first');

    // Assert
    await waitFor(() => expect(result.current).toBe('second'));
  });
});
