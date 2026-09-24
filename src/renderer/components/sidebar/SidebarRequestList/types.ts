import type { MouseEvent } from 'react';

export type CreatingItem = { type: 'folder' | 'request'; parentId: string } | null;

/**
 * Shared click handler for sidebar rows (requests and folders). Interprets modifier keys for
 * multi-select (ctrl/cmd-click toggles, shift-click selects a range) and falls back to
 * `defaultAction` (open request / toggle folder) on a plain click.
 */
export type ItemClickHandler = (id: string, event: MouseEvent, defaultAction: () => void) => void;
