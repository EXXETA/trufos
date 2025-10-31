export type EventListener = (...args: unknown[]) => void;
export type EventHandlers = { [event: string]: EventListener };

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
