export type EventListener = (...args: unknown[]) => void;
export type EventHandlers = { [event: string]: EventListener };

export const ERROR_EVENT = 'error' as const;

export abstract class EventEmitter<Handlers extends { [K in keyof Handlers]: EventListener }> {
  private readonly listeners = new Map<keyof Handlers, Set<Handlers[keyof Handlers]>>();

  on<K extends keyof Handlers>(event: K, listener: Handlers[K]) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    (this.listeners.get(event) as Set<Handlers[K]>).add(listener);
    return this;
  }

  once<K extends keyof Handlers>(event: K, listener: Handlers[K]) {
    const wrapper = ((...args: Parameters<Handlers[K]>) => {
      this.off(event, wrapper);
      listener(...args);
    }) as Handlers[K];
    return this.on(event, wrapper);
  }

  off<K extends keyof Handlers>(event: K, listener: Handlers[K]) {
    this.listeners.get(event)?.delete(listener);
    return this;
  }

  protected emit<K extends keyof Handlers>(event: K, ...args: Parameters<Handlers[K]>) {
    const listeners = this.listeners.get(event) ?? new Set();
    for (const listener of Array.from(listeners)) {
      try {
        listener(...args);
      } catch (e) {
        console.error('Error in event listener for event', event, e);
      }
    }
    return this;
  }
}

/**
 * Wait for a single occurrence of an event from an EventEmitter.
 * @param emitter The {@link EventEmitter} to listen to
 * @param event The event to listen for
 * @returns A promise that resolves with the event arguments or rejects with an error from the 'error' event
 */
export function once<Handlers extends EventHandlers, K extends keyof Handlers>(
  emitter: EventEmitter<Handlers>,
  event: K
) {
  return new Promise<Parameters<Handlers[K]>>((resolve, reject) => {
    const onEvent = ((...args: Parameters<Handlers[K]>) => {
      cleanup();
      resolve(args);
    }) as Handlers[K];

    const onError = ((err: Parameters<Handlers[typeof ERROR_EVENT]>) => {
      cleanup();
      reject(err);
    }) as Handlers[typeof ERROR_EVENT];

    const cleanup = () => {
      emitter.off(event, onEvent);
      emitter.off(ERROR_EVENT, onError);
    };

    emitter.once(event, onEvent);
    emitter.once(ERROR_EVENT, onError);
  });
}
