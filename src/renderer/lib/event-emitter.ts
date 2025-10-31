export type EventListener = (...args: unknown[]) => void;

export abstract class EventEmitter {
  private readonly listeners = new Map<string, Set<EventListener>>();

  on(event: string, listener: EventListener) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(listener);
    return this;
  }

  once(event: string, listener: EventListener) {
    const wrapper: EventListener = (...args) => {
      this.off(event, wrapper);
      listener(...args);
    };
    return this.on(event, wrapper);
  }

  off(event: string, listener: EventListener) {
    this.listeners.get(event)?.delete(listener);
    return this;
  }

  protected emit(event: string, ...args: unknown[]) {
    // copy listeners before iterating to allow them to remove themselves safely during iteration
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
