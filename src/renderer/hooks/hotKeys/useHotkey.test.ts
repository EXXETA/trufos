import { renderHook } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { useHotkeys } from './useHotkey';

const dispatchKeyDown = (init: KeyboardEventInit) => {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  const preventDefault = vi.spyOn(event, 'preventDefault');
  const stopImmediatePropagation = vi.spyOn(event, 'stopImmediatePropagation');
  window.dispatchEvent(event);
  return { event, preventDefault, stopImmediatePropagation };
};

describe('useHotkeys', () => {
  it('invokes the handler and suppresses further handling on a matching hotkey', () => {
    // Arrange
    const handler = vi.fn();
    renderHook(() => useHotkeys([{ keys: 'mod+enter', handler }]));

    // Act
    const { event, preventDefault, stopImmediatePropagation } = dispatchKeyDown({
      key: 'Enter',
      metaKey: true,
    });

    // Assert
    expect(handler).toHaveBeenCalledWith(event);
    expect(preventDefault).toHaveBeenCalled();
    expect(stopImmediatePropagation).toHaveBeenCalled();
  });

  it('does not touch events that do not match a hotkey', () => {
    // Arrange
    const handler = vi.fn();
    renderHook(() => useHotkeys([{ keys: 'mod+enter', handler }]));

    // Act
    const { preventDefault, stopImmediatePropagation } = dispatchKeyDown({ key: 'Enter' });

    // Assert
    expect(handler).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
    expect(stopImmediatePropagation).not.toHaveBeenCalled();
  });

  it('allows opting out of stopping propagation per hotkey', () => {
    // Arrange
    const handler = vi.fn();
    renderHook(() => useHotkeys([{ keys: 'mod+enter', handler, stopPropagation: false }]));

    // Act
    const { stopImmediatePropagation } = dispatchKeyDown({ key: 'Enter', metaKey: true });

    // Assert
    expect(handler).toHaveBeenCalled();
    expect(stopImmediatePropagation).not.toHaveBeenCalled();
  });

  it('skips form elements by default but still runs when skipFormElements is false', () => {
    // Arrange
    const skipping = vi.fn();
    const notSkipping = vi.fn();
    renderHook(() => useHotkeys([{ keys: 'mod+enter', handler: skipping }]));
    renderHook(() =>
      useHotkeys([{ keys: 'mod+enter', handler: notSkipping }], { skipFormElements: false })
    );

    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    textarea.focus();

    // Act
    const event = new KeyboardEvent('keydown', {
      key: 'Enter',
      metaKey: true,
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(event, 'target', { value: textarea });
    window.dispatchEvent(event);

    // Assert
    expect(skipping).not.toHaveBeenCalled();
    expect(notSkipping).toHaveBeenCalled();

    document.body.removeChild(textarea);
  });

  it('does not match an unrequested modifier: a plain "tab" hotkey does not fire on Shift+Tab', () => {
    // Arrange
    const handler = vi.fn();
    renderHook(() => useHotkeys([{ keys: 'tab', handler }]));

    // Act
    dispatchKeyDown({ key: 'Tab', shiftKey: true });

    // Assert
    expect(handler).not.toHaveBeenCalled();
  });

  it('does not match a missing modifier: a "shift+tab" hotkey does not fire on plain Tab', () => {
    // Arrange
    const handler = vi.fn();
    renderHook(() => useHotkeys([{ keys: 'shift+tab', handler }]));

    // Act
    dispatchKeyDown({ key: 'Tab' });

    // Assert
    expect(handler).not.toHaveBeenCalled();
  });

  it('"tab" and "shift+tab" resolve to different handlers regardless of registration order', () => {
    // Arrange
    const forward = vi.fn();
    const backward = vi.fn();
    renderHook(() =>
      useHotkeys([
        { keys: 'tab', handler: forward },
        { keys: 'shift+tab', handler: backward },
      ])
    );

    // Act
    dispatchKeyDown({ key: 'Tab' });
    dispatchKeyDown({ key: 'Tab', shiftKey: true });

    // Assert
    expect(forward).toHaveBeenCalledTimes(1);
    expect(backward).toHaveBeenCalledTimes(1);
  });

  it('does not match an unrequested modifier: "mod+s" does not fire on Cmd/Ctrl+Shift+S', () => {
    // Arrange
    const handler = vi.fn();
    renderHook(() => useHotkeys([{ keys: 'mod+s', handler }]));

    // Act
    dispatchKeyDown({ key: 's', metaKey: true, shiftKey: true });

    // Assert
    expect(handler).not.toHaveBeenCalled();
  });
});
