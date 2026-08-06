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
  // Request body tabs (InputTabs.tsx)
  selectBodyTab: 'mod+1',
  selectQueryParamsTab: 'mod+2',
  selectHeadersTab: 'mod+3',
  selectAuthorizationTab: 'mod+4',
  selectScriptsTab: 'mod+5',
  // Response tabs (OutputTabs.tsx)
  selectResponseBodyTab: 'mod+6',
  selectResponseHeadersTab: 'mod+7',
  // Sidebar request navigation (SidebarRequestList.tsx)
  selectPreviousRequest: 'mod+pageup',
  selectNextRequest: 'mod+pagedown',
} as const;

export type HotkeyName = keyof typeof HOTKEYS;
