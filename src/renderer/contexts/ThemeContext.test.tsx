import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider, TrufosTheme } from '@/contexts/ThemeContext';
import { useAppSettingsStore } from '@/state/appSettingsStore';

vi.mock('@/services/event/renderer-event-service', () => ({
  RendererEventService: { instance: {} },
}));

/** Fake `(prefers-color-scheme: dark)` media query whose result can be changed by the test. */
const createSystemScheme = (dark: boolean) => {
  const listeners = new Set<() => void>();
  const query = {
    matches: dark,
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
  };
  return {
    matchMedia: () => query,
    setDark(value: boolean) {
      query.matches = value;
      listeners.forEach((listener) => listener());
    },
  };
};

const rootClasses = () => [...document.documentElement.classList];

describe('ThemeProvider', () => {
  let systemScheme: ReturnType<typeof createSystemScheme>;

  beforeEach(() => {
    systemScheme = createSystemScheme(true);
    vi.stubGlobal('matchMedia', systemScheme.matchMedia);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.documentElement.className = '';
  });

  it('follows the system theme when the preference is system', () => {
    useAppSettingsStore.setState({ theme: 'system' });
    render(<ThemeProvider>content</ThemeProvider>);
    expect(rootClasses()).toEqual([TrufosTheme.Dark]);

    act(() => systemScheme.setDark(false));

    expect(rootClasses()).toEqual([TrufosTheme.Light]);
  });

  it('uses an explicit preference regardless of the system theme', () => {
    useAppSettingsStore.setState({ theme: TrufosTheme.Light });
    render(<ThemeProvider>content</ThemeProvider>);
    expect(rootClasses()).toEqual([TrufosTheme.Light]);

    act(() => systemScheme.setDark(true));

    expect(rootClasses()).toEqual([TrufosTheme.Light]);
  });

  it('switches when the preference changes', () => {
    useAppSettingsStore.setState({ theme: TrufosTheme.Light });
    render(<ThemeProvider>content</ThemeProvider>);

    act(() => useAppSettingsStore.setState({ theme: 'system' }));

    expect(rootClasses()).toEqual([TrufosTheme.Dark]);
  });
});
