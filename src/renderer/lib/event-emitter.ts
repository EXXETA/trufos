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

  off(event: string, listener: EventListener) {
    this.listeners.get(event)?.delete(listener);
    return this;
  }

  protected emit(event: string, ...args: unknown[]) {
    for (const listener of this.listeners.get(event) ?? []) {
      listener(...args);
    }
    return this;
  }
}
