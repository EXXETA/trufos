import type { ReactElement } from 'react';
import { Command as CommandShortcutIcon } from 'lucide-react';

const isMac = navigator.platform.startsWith('Mac');

/**
 * Formats a `HOTKEYS.*` string (the same `'+'`-separated format `matchesHotkey` parses, see
 * `useHotkey.ts`) into a platform-aware display badge: the Mac ⌘ glyph or the literal `'Ctrl'`
 * for the modifier, and the uppercased trailing key (`'enter'` → `'Enter'`).
 */
export function formatHotkeyForDisplay(hotkey: string): {
  modifier: ReactElement | string;
  key: string;
} {
  const parts = hotkey.toLowerCase().split('+');
  const rawKey = parts[parts.length - 1];
  const key = rawKey === 'enter' ? 'Enter' : rawKey.toUpperCase();

  return {
    modifier: isMac ? <CommandShortcutIcon size={12} /> : 'Ctrl',
    key,
  };
}
