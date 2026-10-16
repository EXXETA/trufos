import { applyPatches } from 'immer';
import {
  applyCommandTo,
  CollectionCommand,
  CollectionModel,
  CollectionStateEvent,
  CommandEnvelope,
} from 'shim/collection-model';

/**
 * Sends a command to the main process. Resolves with the model version main applied it as, which
 * may be before its patches arrive.
 */
export type SendCommand = (envelope: CommandEnvelope) => Promise<number>;

/** Fetches the complete state of the open collection from the main process. */
export type FetchSnapshot = () => Promise<CollectionModel>;

/** Called with the new visible model whenever it changes. */
export type OnModelChange = (model: CollectionModel) => void;

/** A command that was sent but whose patches did not arrive yet. */
interface PendingCommand {
  envelope: CommandEnvelope;
  /**
   * The version main applied the command as, once main replied. The IPC does not order a reply
   * and a broadcast, so the reply can come before the patches. Every snapshot of this version or
   * later contains the command.
   */
  appliedVersion?: number;
}

type PatchesEvent = Extract<CollectionStateEvent, { kind: 'patches' }>;

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
  private pending: PendingCommand[] = [];
  /** Set while a snapshot is fetched. */
  private resyncing?: Promise<void>;
  /**
   * The patches received while a snapshot is fetched. Those the snapshot does not contain yet are
   * applied on top of it.
   */
  private buffered: PatchesEvent[] = [];

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
    const pending: PendingCommand = { envelope };
    this.pending.push(pending);
    this.onChange(this.visible);
    return this.sendPending(pending);
  }

  /** Applies a {@link CollectionStateEvent} broadcast by the main process. */
  receive(event: CollectionStateEvent): void {
    if (event.kind === 'snapshot') {
      this.pending = [];
      this.buffered = [];
      this.setConfirmed(event.model);
    } else if (event.version <= this.confirmed.version) {
      // the patches of a command that a snapshot already contained
      this.removePending(event.commandId);
    } else if (this.resyncing != null) {
      this.buffered.push(event);
    } else if (event.version !== this.confirmed.version + 1) {
      console.warn(
        `Missed a collection update (expected version ${this.confirmed.version + 1}, got ${event.version})`
      );
      this.buffered.push(event);
      void this.resync();
    } else if (this.pending[0]?.envelope.commandId === event.commandId) {
      // Main confirmed the oldest pending command. The visible model was built from the confirmed
      // one with exactly this command first, the same way main did, so the confirmed model moves
      // one step closer to the visible one and nothing visible changes.
      this.removePending(event.commandId);
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
    if (this.resyncing != null) return this.resyncing;
    this.resyncing = this.fetchSnapshot().then(
      (snapshot) => {
        this.resyncing = undefined;
        this.rebaseOnto(snapshot, this.takeBuffered());
      },
      (error: unknown) => {
        this.resyncing = undefined;
        // Without a snapshot, the held back patches cannot be applied. Dropping them leaves a gap
        // in the versions, so the next broadcast resyncs again.
        this.takeBuffered();
        console.error('Could not fetch the collection state', error);
        // at least drop the pending commands that were removed meanwhile, e.g. rejected ones
        this.setConfirmed(this.confirmed);
      }
    );
    return this.resyncing;
  }

  /** Returns the patches held back during a resync and forgets them. */
  private takeBuffered(): PatchesEvent[] {
    const buffered = this.buffered;
    this.buffered = [];
    return buffered;
  }

  /**
   * Makes a fetched snapshot the confirmed model and applies what happened since on top of it.
   * @param snapshot the fetched snapshot. It is ignored if it is older than the confirmed model,
   * e.g. because a snapshot of another collection was broadcast while it was fetched.
   * @param buffered the patches that arrived while the snapshot was fetched
   */
  private rebaseOnto(snapshot: CollectionModel, buffered: PatchesEvent[]) {
    if (snapshot.version >= this.confirmed.version) {
      // A pending command is part of the snapshot if main replied with a version the snapshot
      // has, or if its patches arrived and are part of the snapshot. Re-applying it on top would
      // apply it twice.
      const contained = new Set(
        buffered.filter((event) => event.version <= snapshot.version).map((e) => e.commandId)
      );
      this.pending = this.pending.filter(
        ({ envelope, appliedVersion }) =>
          !contained.has(envelope.commandId) &&
          (appliedVersion == null || appliedVersion > snapshot.version)
      );
      this.setConfirmed(snapshot);
    }
    // patches the snapshot already contains only confirm their command, the others are applied
    for (const event of buffered) this.receive(event);
  }

  private async sendPending(pending: PendingCommand): Promise<void> {
    try {
      pending.appliedVersion = await this.send(pending.envelope);
    } catch (error) {
      this.removePending(pending.envelope.commandId);
      await this.resync();
      throw error;
    }
  }

  /** Removes a pending command without recomputing the visible model. */
  private removePending(commandId: string) {
    this.pending = this.pending.filter(({ envelope }) => envelope.commandId !== commandId);
  }

  /** Replaces the confirmed model and rebases the pending commands onto it. */
  private setConfirmed(model: CollectionModel) {
    this.confirmed = model;
    let visible = model;
    this.pending = this.pending.filter(({ envelope }) => {
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
