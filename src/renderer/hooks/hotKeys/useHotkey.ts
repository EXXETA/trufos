import { useEffect, useRef } from 'react';

type HotkeyConfig = {
  keys: string;
  handler: (event: KeyboardEvent) => void;
  enabled?: boolean;
  skipFormElements?: boolean;
  preventDefault?: boolean;
};

type UseHotkeysOptions = {
  enabled?: boolean;
  capture?: boolean;
  skipFormElements?: boolean;
  preventDefault?: boolean;
};

const isFormElement = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;

  return (
    target.nodeName === 'INPUT' ||
    target.nodeName === 'TEXTAREA' ||
    target.nodeName === 'SELECT' ||
    target.isContentEditable
  );
};

const normalizeKey = (key: string) => key.toLowerCase();

const matchesHotkey = (event: KeyboardEvent, hotkey: string) => {
  const parts = hotkey.toLowerCase().split('+');
  const key = parts[parts.length - 1];

  const needsMod = parts.includes('mod');
  const needsCtrl = parts.includes('ctrl');
  const needsMeta = parts.includes('meta') || parts.includes('cmd');
  const needsShift = parts.includes('shift');
  const needsAlt = parts.includes('alt');

  if (needsMod && !event.ctrlKey && !event.metaKey) return false;
  if (needsCtrl && !event.ctrlKey) return false;
  if (needsMeta && !event.metaKey) return false;
  if (needsShift && !event.shiftKey) return false;
  if (needsAlt && !event.altKey) return false;

  return normalizeKey(event.key) === key;
};

export const useHotkeys = (
  hotkeys: HotkeyConfig[],
  {
    enabled = true,
    capture = true,
    skipFormElements = true,
    preventDefault = true,
  }: UseHotkeysOptions = {}
) => {
  const hotkeysRef = useRef(hotkeys);

  useEffect(() => {
    hotkeysRef.current = hotkeys;
  }, [hotkeys]);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const matchedHotkey = hotkeysRef.current.find((hotkey) => {
        const shouldSkipFormElements = hotkey.skipFormElements ?? skipFormElements;

        if (shouldSkipFormElements && isFormElement(event.target)) {
          return false;
        }

        if (hotkey.enabled === false) {
          return false;
        }

        return matchesHotkey(event, hotkey.keys);
      });

      if (!matchedHotkey) return;

      const shouldPreventDefault = matchedHotkey.preventDefault ?? preventDefault;

      if (shouldPreventDefault) {
        event.preventDefault();
      }

      matchedHotkey.handler(event);
    };

    window.addEventListener('keydown', handleKeyDown, capture);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, capture);
    };
  }, [enabled, capture, skipFormElements, preventDefault]);
};
