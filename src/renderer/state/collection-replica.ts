import { applyPatches } from 'immer';
import {
  applyCommandTo,
  CollectionCommand,
  CollectionModel,
  CollectionStateEvent,
  CommandEnvelope,
} from 'shim/collection-model';

/** Sends a command to the main process. Resolves after main applied and broadcast it. */
export type SendCommand = (envelope: CommandEnvelope) => Promise<void>;

/** Fetches the complete state of the open collection from the main process. */
export type FetchSnapshot = () => Promise<CollectionModel>;

/**
 * The renderer's replica of the {@link CollectionModel} owned by the main process.
 *
 * It keeps the last state confirmed by main and the commands that were sent but not confirmed yet.
 * The visible {@link model} is the confirmed state with these pending commands re-applied, so
 * changes show up at once and are corrected as soon as main disagrees.
 */
export class CollectionReplica {
  private confirmed: CollectionModel;
  private visible: CollectionModel;
  private pending: CommandEnvelope[] = [];
  private readonly listeners = new Set<() => void>();
  /** Set while a snapshot is fetched. Patches received meanwhile are part of that snapshot. */
  private resyncing?: Promise<void>;

  constructor(
    snapshot: CollectionModel,
    private readonly send: SendCommand,
    private readonly fetchSnapshot: FetchSnapshot
  ) {
    this.confirmed = this.visible = snapshot;
  }

  /** The visible model: the confirmed state with all pending commands applied. */
  get model(): CollectionModel {
    return this.visible;
  }

  /**
   * Calls the listener whenever the visible model changes.
   * @returns a function that removes the listener
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Applies the command optimistically and sends it to the main process.
   * @throws CommandError synchronously, without sending anything, if the command cannot be applied
   * to the visible model
   * @returns a promise that rejects if main rejected the command. The replica resyncs in that case.
   */
  dispatch(command: CollectionCommand): Promise<void> {
    const envelope: CommandEnvelope = {
      commandId: crypto.randomUUID(),
      timestamp: Date.now(),
      command,
    };
    this.visible = applyCommandTo(this.visible, envelope);
    this.pending.push(envelope);
    this.notify();
    return this.sendPending(envelope);
  }

  /** Applies a {@link CollectionStateEvent} broadcast by the main process. */
  receive(event: CollectionStateEvent): void {
    if (event.kind === 'snapshot') {
      this.pending = [];
      this.setConfirmed(event.model);
    } else if (this.resyncing != null) {
      // The snapshot being fetched already contains these patches, so they are not applied. The
      // command they confirm must not stay pending though, or it would be applied a second time
      // on top of the snapshot. The visible model keeps it until the snapshot arrives.
      this.pending = this.pending.filter(({ commandId }) => commandId !== event.commandId);
    } else if (event.version !== this.confirmed.version + 1) {
      console.warn(
        `Missed a collection update (expected version ${this.confirmed.version + 1}, got ${event.version})`
      );
      void this.resync();
    } else {
      this.pending = this.pending.filter(({ commandId }) => commandId !== event.commandId);
      this.setConfirmed(applyPatches(this.confirmed, event.patches));
    }
  }

  /**
   * Fetches a fresh snapshot from the main process and re-applies the pending commands that are
   * still in flight on top of it.
   */
  resync(): Promise<void> {
    this.resyncing ??= this.fetchSnapshot()
      .then((snapshot) => this.setConfirmed(snapshot))
      .catch((error) => console.error('Could not fetch the collection state', error))
      .finally(() => (this.resyncing = undefined));
    return this.resyncing;
  }

  private async sendPending(envelope: CommandEnvelope): Promise<void> {
    try {
      await this.send(envelope);
    } catch (error) {
      this.dropPending(envelope.commandId);
      await this.resync();
      throw error;
    }

    // main broadcasts the patches before it resolves, so the command is normally confirmed by now
    if (this.dropPending(envelope.commandId)) {
      console.warn('Command', envelope.commandId, 'was applied without a matching update');
      await this.resync();
    }
  }

  /** Removes a pending command and recomputes the visible model. Returns false if it was absent. */
  private dropPending(commandId: string): boolean {
    const index = this.pending.findIndex((envelope) => envelope.commandId === commandId);
    if (index === -1) return false;
    this.pending.splice(index, 1);
    this.setConfirmed(this.confirmed);
    return true;
  }

  /** Replaces the confirmed model and rebases the pending commands onto it. */
  private setConfirmed(model: CollectionModel) {
    this.confirmed = model;
    let visible = model;
    this.pending = this.pending.filter((envelope) => {
      try {
        visible = applyCommandTo(visible, envelope);
        return true;
      } catch (error) {
        console.warn('Dropping command', envelope.commandId, 'that no longer applies', error);
        return false;
      }
    });
    this.visible = visible;
    this.notify();
  }

  private notify() {
    for (const listener of this.listeners) listener();
  }
}
