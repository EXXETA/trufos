import type { WebContents } from 'electron';
import type { MainProcessEvent, MainProcessEventPayloads } from 'shim/event-service';

/**
 * Pushes an event to the renderer. Every event sent to the renderer must go through this function,
 * as Electron does not type the payload of `webContents.send()`.
 * @param webContents the renderer to send the event to. Nothing is sent if it is missing, e.g.
 * before the window was created.
 * @param event the event
 * @param payload the payload of the event, see {@link MainProcessEventPayloads}
 */
export function sendToRenderer<E extends MainProcessEvent>(
  webContents: WebContents | undefined,
  event: E,
  ...payload: MainProcessEventPayloads[E]
): void {
  webContents?.send(event, ...payload);
}
