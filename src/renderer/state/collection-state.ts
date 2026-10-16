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

/** Called with the new visible model whenever it changes. */
export type OnModelChange = (model: CollectionModel) => void;

/**
 * The renderer's state of the open collection. The main process owns the {@link CollectionModel};
 * this class follows it from the patches main broadcasts and applies own commands optimistically.
 *
 * It keeps the last state confirmed by main and the commands that were sent but not confirmed yet.
 * The visible {@link model} is the confirmed state with these pending commands re-applied, so
 * changes show up at once and are corrected as soon as main disagrees.
 */
export class CollectionState {
  private confirmed: CollectionModel;
  private visible: CollectionModel;
  private pending: CommandEnvelope[] = [];
  /** Set while a snapshot is fetched. Patches received meanwhile are part of that snapshot. */
  private resyncing?: Promise<void>;

  constructor(
    snapshot: CollectionModel,
    private readonly send: SendCommand,
    private readonly fetchSnapshot: FetchSnapshot,
    private readonly onChange: OnModelChange
  ) {
    this.confirmed = this.visible = snapshot;
  }

  /** The visible model: the confirmed state with all pending commands applied. */
  get model(): CollectionModel {
    return this.visible;
  }

  /**
   * Applies the command optimistically and sends it to the main process.
   * @throws CommandError synchronously, without sending anything, if the command cannot be applied
   * to the visible model
   * @returns a promise that rejects if main rejected the command. The state resyncs in that case.
   */
  dispatch(command: CollectionCommand): Promise<void> {
    const envelope: CommandEnvelope = {
      commandId: crypto.randomUUID(),
      timestamp: Date.now(),
      command,
    };
    this.visible = applyCommandTo(this.visible, envelope);
    this.pending.push(envelope);
    this.onChange(this.visible);
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
      this.removePending(event.commandId);
    } else if (event.version !== this.confirmed.version + 1) {
      console.warn(
        `Missed a collection update (expected version ${this.confirmed.version + 1}, got ${event.version})`
      );
      // the snapshot fetched now contains the confirmed command, see above
      this.removePending(event.commandId);
      void this.resync();
    } else if (this.pending[0]?.commandId === event.commandId) {
      // Main confirmed the oldest pending command. The visible model was built from the confirmed
      // one with exactly this command first, the same way main did, so the confirmed model moves
      // one step closer to the visible one and nothing visible changes.
      this.pending.shift();
      this.confirmed =
        this.pending.length === 0
          ? (this.visible = { ...this.visible, version: event.version })
          : applyPatches(this.confirmed, event.patches);
    } else {
      this.removePending(event.commandId);
      this.setConfirmed(applyPatches(this.confirmed, event.patches));
    }
  }

  /**
   * Fetches a fresh snapshot from the main process and re-applies the pending commands that are
   * still in flight on top of it.
   */
  resync(): Promise<void> {
    this.resyncing ??= this.fetchSnapshot()
      .then((snapshot) => {
        // a snapshot broadcast while this one was fetched is newer, e.g. of another collection
        if (snapshot.version >= this.confirmed.version) this.setConfirmed(snapshot);
      })
      .catch((error) => console.error('Could not fetch the collection state', error))
      .finally(() => (this.resyncing = undefined));
    return this.resyncing;
  }

  private async sendPending(envelope: CommandEnvelope): Promise<void> {
    try {
      await this.send(envelope);
    } catch (error) {
      if (this.removePending(envelope.commandId)) this.setConfirmed(this.confirmed);
      await this.resync();
      throw error;
    }

    // main broadcasts the patches before it resolves, so the command is normally confirmed by now
    if (this.removePending(envelope.commandId)) {
      console.warn('Command', envelope.commandId, 'was applied without a matching update');
      this.setConfirmed(this.confirmed);
      await this.resync();
    }
  }

  /** Removes a pending command without recomputing the visible model. Returns false if absent. */
  private removePending(commandId: string): boolean {
    const index = this.pending.findIndex((envelope) => envelope.commandId === commandId);
    if (index === -1) return false;
    this.pending.splice(index, 1);
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
    this.onChange(visible);
  }
}
