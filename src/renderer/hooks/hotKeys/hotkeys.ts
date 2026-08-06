/**
 * Single source of truth for every global keyboard shortcut string registered via `useHotkeys`
 * somewhere in the renderer. Both the real `useHotkeys` registration and any UI that displays the
 * shortcut (e.g. `CommandPalette.tsx`'s action-item badges, via `formatHotkeyForDisplay`) read
 * from this map — changing a value here changes the real binding and every place it's shown.
 */
export const HOTKEYS = {
  openCommandPalette: 'mod+k',
  sendRequest: 'mod+enter',
  saveRequest: 'mod+s',
  newRequest: 'mod+n',
} as const;

export type HotkeyName = keyof typeof HOTKEYS;
