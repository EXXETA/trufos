import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { CollectionReplica } from './collection-replica';
import { FakeCollectionMain, makeModel } from '@/__mocks__/fake-collection-main';
import { CollectionCommand, CommandEnvelope, CommandError } from 'shim/collection-model';

let main: FakeCollectionMain;
let replica: CollectionReplica;
let listener: Mock<() => void>;

const foreign = (command: CollectionCommand, commandId = 'foreign'): CommandEnvelope => ({
  commandId,
  timestamp: 1,
  command,
});

beforeEach(() => {
  main = new FakeCollectionMain(makeModel());
  replica = new CollectionReplica(
    structuredClone(main.model),
    (envelope) => main.dispatch(envelope),
    () => main.getCollectionState()
  );
  main.onEvent((event) => replica.receive(event));
  listener = vi.fn<() => void>();
  replica.subscribe(listener);
});

describe('CollectionReplica', () => {
  it('applies a command optimistically before main confirms it', () => {
    main.broadcast = false;
    void replica.dispatch({ type: 'rename', id: 'r1', title: 'Renamed' }).catch(() => {});

    expect(replica.model.requests.get('r1')!.title).toBe('Renamed');
    expect(listener).toHaveBeenCalled();
  });

  it('keeps unchanged objects when applying a command', () => {
    const before = replica.model;
    void replica.dispatch({ type: 'rename', id: 'r1', title: 'Renamed' });

    expect(replica.model.requests.get('r2')).toBe(before.requests.get('r2'));
    expect(replica.model.folders.get('f1')).toBe(before.folders.get('f1'));
  });

  it('throws synchronously without sending if the command cannot be applied', () => {
    expect(() => replica.dispatch({ type: 'rename', id: 'missing', title: 'x' })).toThrow(
      CommandError
    );
    expect(main.received).toHaveLength(0);
  });

  it('removes its own command from pending when the echo arrives', async () => {
    await replica.dispatch({ type: 'rename', id: 'r1', title: 'Renamed' });

    expect(replica.model.version).toBe(1);
    expect(replica.model.requests.get('r1')!.title).toBe('Renamed');
    // re-applying a stale pending command would bump the title again on the next update
    await main.dispatch(foreign({ type: 'rename', id: 'r1', title: 'Other' }));
    expect(replica.model.requests.get('r1')!.title).toBe('Other');
  });

  it('rebases pending commands onto foreign patches', async () => {
    let release!: () => Promise<void>;
    // a fresh main, so the replica from beforeEach does not receive every event a second time
    main = new FakeCollectionMain(makeModel());
    replica = new CollectionReplica(
      structuredClone(main.model),
      (envelope) =>
        new Promise((resolve) => (release = () => main.dispatch(envelope).then(resolve))),
      () => main.getCollectionState()
    );
    main.onEvent((event) => replica.receive(event));
    const pending = replica.dispatch({ type: 'rename', id: 'r1', title: 'Mine' });

    await main.dispatch(foreign({ type: 'rename', id: 'r2', title: 'Theirs' }));
    expect(replica.model.requests.get('r2')!.title).toBe('Theirs');
    expect(replica.model.requests.get('r1')!.title).toBe('Mine');

    await release();
    await pending;
    expect(replica.model.version).toBe(2);
    expect(replica.model.requests.get('r1')!.title).toBe('Mine');
  });

  it('drops pending commands that no longer apply after foreign patches', async () => {
    main.broadcast = false;
    const pending = replica.dispatch({ type: 'rename', id: 'r1', title: 'Mine' });
    main.broadcast = true;
    main.model = makeModel();

    await main.dispatch(foreign({ type: 'delete', id: 'r1' }));

    expect(replica.model.requests.has('r1')).toBe(false);
    await pending;
  });

  it('resyncs when a version is skipped', async () => {
    const snapshot = vi.spyOn(main, 'getCollectionState');
    main.broadcast = false;
    await main.dispatch(foreign({ type: 'rename', id: 'r2', title: 'Missed' }, 'a'));
    main.broadcast = true;
    await main.dispatch(foreign({ type: 'rename', id: 'r3', title: 'Seen' }, 'b'));
    await vi.waitFor(() => expect(replica.model.version).toBe(2));

    expect(snapshot).toHaveBeenCalledOnce();
    expect(replica.model.requests.get('r2')!.title).toBe('Missed');
    expect(replica.model.requests.get('r3')!.title).toBe('Seen');
  });

  it('does not re-apply a command that main confirmed during a resync', async () => {
    main = new FakeCollectionMain(makeModel());
    let releaseSnapshot!: () => void;
    const snapshot = vi.fn(() =>
      new Promise<void>((resolve) => (releaseSnapshot = resolve)).then(() =>
        main.getCollectionState()
      )
    );
    replica = new CollectionReplica(
      structuredClone(main.model),
      (envelope) => main.dispatch(envelope),
      snapshot
    );
    main.onEvent((event) => replica.receive(event));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const resync = replica.resync();

    const copied = replica.dispatch({ type: 'copy', id: 'r3', idMap: { r3: 'r3-copy' } });
    expect(replica.model.requests.has('r3-copy')).toBe(true);
    await vi.waitFor(() => expect(main.model.requests.has('r3-copy')).toBe(true));

    releaseSnapshot();
    await Promise.all([copied, resync]);

    expect(snapshot).toHaveBeenCalledOnce();
    expect(warn).not.toHaveBeenCalled();
    expect(replica.model.version).toBe(1);
    expect(replica.model.requests.has('r3-copy')).toBe(true);
    expect(replica.model.childIds.get('col')).toEqual(['f1', 'r3', 'r3-copy']);
    warn.mockRestore();
  });

  it('drops a rejected command, resyncs and rethrows', async () => {
    const snapshot = vi.spyOn(main, 'getCollectionState');
    main.rejectNext = new Error('invalid');

    await expect(replica.dispatch({ type: 'rename', id: 'r1', title: 'Renamed' })).rejects.toThrow(
      'invalid'
    );

    expect(snapshot).toHaveBeenCalledOnce();
    expect(replica.model.requests.get('r1')!.title).toBe('r1');
  });

  it('clears pending commands when a snapshot arrives', () => {
    main.broadcast = false;
    void replica.dispatch({ type: 'rename', id: 'r1', title: 'Renamed' });
    const other = makeModel({ id: 'other' });

    replica.receive({ kind: 'snapshot', model: other });

    expect(replica.model).toBe(other);
  });

  it('resyncs if main resolves a command without broadcasting it', async () => {
    main.broadcast = false;
    await replica.dispatch({ type: 'rename', id: 'r1', title: 'Renamed' });

    expect(replica.model.version).toBe(1);
    expect(replica.model.requests.get('r1')!.title).toBe('Renamed');
  });
});
