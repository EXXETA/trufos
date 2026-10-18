import {
  applyCommandWithPatches,
  CollectionModel,
  CollectionSnapshot,
  CollectionStateEvent,
  CommandEnvelope,
} from 'shim/collection-model';

/**
 * Plays the part of the main process' `CollectionStateService` in renderer tests: it applies
 * commands with the shared reducer, increments the version and broadcasts the patches, all through
 * `structuredClone` like the IPC would.
 */
export class FakeCollectionMain {
  private readonly listeners = new Set<(event: CollectionStateEvent) => void>();
  /** Every envelope main received, in order. */
  readonly received: CommandEnvelope[] = [];
  /** If set, the next dispatch rejects with this error without applying the command. */
  rejectNext?: Error;
  /** If false, dispatches are applied but no patches are broadcast. */
  broadcast = true;
  /**
   * If true, broadcasts are held back until {@link flushBroadcasts} is called. The IPC does not
   * order the reply of a dispatch and the broadcast of its patches, so the reply can come first.
   */
  holdBroadcasts = false;
  private readonly held: CollectionStateEvent[] = [];

  constructor(public model: CollectionModel) {}

  /** Implements `IEventService.dispatch`. */
  dispatch = async (envelope: CommandEnvelope): Promise<number> => {
    this.received.push(envelope);
    if (this.rejectNext != null) {
      const error = this.rejectNext;
      this.rejectNext = undefined;
      throw error;
    }
    const [model, patches] = applyCommandWithPatches(this.model, envelope);
    this.model = model;
    if (this.broadcast) {
      const event: CollectionStateEvent = {
        kind: 'patches',
        version: model.version,
        patches,
        commandId: envelope.commandId,
      };
      if (this.holdBroadcasts) this.held.push(event);
      else this.emit(event);
    }
    return model.version;
  };

  /** Broadcasts the events held back by {@link holdBroadcasts}, in order. */
  flushBroadcasts(): void {
    for (const event of this.held.splice(0)) this.emit(event);
  }

  /** Implements `IEventService.getCollectionState`. */
  getCollectionState = async (): Promise<CollectionSnapshot> => ({
    model: structuredClone(this.model),
  });

  /** Broadcasts an event to all listeners, like `MainProcessEvent.CollectionStateChanged`. */
  emit(event: CollectionStateEvent): void {
    const copy = structuredClone(event);
    for (const listener of this.listeners) listener(copy);
  }

  onEvent(listener: (event: CollectionStateEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
