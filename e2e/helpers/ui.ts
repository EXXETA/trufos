import { expect, Locator, Page } from '@playwright/test';

/** The sidebar row of a request or folder, matched by its visible name. */
export function sidebarItem(window: Page, name: string): Locator {
  return window.locator('.sidebar-request-list-item').filter({ hasText: name });
}

/**
 * The monaco-backed URL field of the selected request.
 *
 * Monaco carries the accessible name on its hidden `EditContext` input surface, so that element
 * can be used to identify the right editor but never to interact with it. The visible editor is
 * therefore matched as the ancestor that holds it.
 */
export function urlEditor(window: Page): Locator {
  return window
    .locator('.monaco-editor')
    .filter({ has: window.locator('[role="textbox"][aria-label="URL"]') });
}

/** The rendered text of the URL field. */
export function urlText(window: Page): Locator {
  return urlEditor(window).locator('.view-lines');
}

/**
 * Replaces the URL of the selected request.
 *
 * The field is a monaco editor rather than an `<input>`, so it has to be driven through real key
 * events: `fill()` would write into monaco's hidden input surface without the editor ever
 * noticing. Keys go to the page because the element that receives them is not visible.
 */
export async function setUrl(window: Page, url: string): Promise<void> {
  await urlEditor(window).click();
  await window.keyboard.press('ControlOrMeta+a');
  await window.keyboard.type(url);
  await expect(urlText(window)).toContainText(url);
}

/**
 * Creates a request in the collection root and waits for it to appear in the sidebar.
 *
 * @param window the main window
 * @param name the title of the new request
 */
export async function createRequest(window: Page, name: string): Promise<void> {
  await window.getByRole('button', { name: 'Add new request' }).click();

  const nameInput = window.locator('.sidebar-request-list-item').getByRole('textbox');
  await nameInput.fill(name);
  await nameInput.press('Enter');

  await expect(sidebarItem(window, name)).toBeVisible();
}

/** Selects a request in the sidebar and waits for its editor to open. */
export async function selectRequest(window: Page, name: string): Promise<void> {
  await sidebarItem(window, name).click();
  await expect(urlEditor(window)).toBeVisible();
}

/**
 * Sends the selected request.
 *
 * Waiting for the result is left to the caller's assertion, which retries on its own. Waiting here
 * would be a false comfort: the send button is only relabelled to "Cancel" once React re-renders,
 * so watching the label returns before the request has even gone out.
 */
export async function sendRequest(window: Page): Promise<void> {
  await window.getByRole('button', { name: 'Send' }).click();
}

/** The status line of the response pane, e.g. `200 OK`. */
export function responseStatus(window: Page): Locator {
  return window.locator('.response-status');
}

/**
 * A tab of the response pane.
 *
 * The request and response panes both have a tab called "Headers", so the tab strip is identified
 * first by a tab only the response pane has.
 */
export function responseTab(window: Page, name: string): Locator {
  return window
    .getByRole('tablist')
    .filter({ has: window.getByRole('tab', { name: 'Response Body' }) })
    .getByRole('tab', { name, exact: true });
}

/** The currently shown toast messages, which is how the app reports errors. */
export function toasts(window: Page): Locator {
  return window.locator('[data-sonner-toast]');
}
