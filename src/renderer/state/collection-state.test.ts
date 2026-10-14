import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { CollectionState } from './collection-state';
import { FakeCollectionMain, makeModel } from '@/__mocks__/fake-collection-main';
import {
  CollectionCommand,
  CollectionModel,
  CommandEnvelope,
  CommandError,
  CommandType,
} from 'shim/collection-model';

let main: FakeCollectionMain;
let state: CollectionState;
let onChange: Mock<(model: CollectionModel) => void>;

const foreign = (command: CollectionCommand, commandId = 'foreign'): CommandEnvelope => ({
  commandId,
  timestamp: 1,
  command,
});

beforeEach(() => {
  main = new FakeCollectionMain(makeModel());
  onChange = vi.fn<(model: CollectionModel) => void>();
  state = new CollectionState(
    structuredClone(main.model),
    (envelope) => main.dispatch(envelope),
    () => main.getCollectionState(),
    onChange
  );
  main.onEvent((event) => state.receive(event));
});

describe('CollectionState', () => {
  it('applies a command optimistically before main confirms it', () => {
    main.broadcast = false;
    void state.dispatch({ type: CommandType.RENAME, id: 'r1', title: 'Renamed' }).catch(() => {});

    expect(state.model.requests.get('r1')!.title).toBe('Renamed');
    expect(onChange).toHaveBeenCalledWith(state.model);
  });

  it('keeps unchanged objects when applying a command', () => {
    const before = state.model;
    void state.dispatch({ type: CommandType.RENAME, id: 'r1', title: 'Renamed' });

    expect(state.model.requests.get('r2')).toBe(before.requests.get('r2'));
    expect(state.model.folders.get('f1')).toBe(before.folders.get('f1'));
  });

  it('throws synchronously without sending if the command cannot be applied', () => {
    expect(() => state.dispatch({ type: CommandType.RENAME, id: 'missing', title: 'x' })).toThrow(
      CommandError
    );
    expect(main.received).toHaveLength(0);
  });

  it('removes its own command from pending when the echo arrives', async () => {
    await state.dispatch({ type: CommandType.RENAME, id: 'r1', title: 'Renamed' });

    expect(state.model.version).toBe(1);
    expect(state.model.requests.get('r1')!.title).toBe('Renamed');
    // re-applying a stale pending command would bump the title again on the next update
    await main.dispatch(foreign({ type: CommandType.RENAME, id: 'r1', title: 'Other' }));
    expect(state.model.requests.get('r1')!.title).toBe('Other');
  });

  it('keeps the optimistic model when main confirms the only pending command', async () => {
    await state.dispatch({ type: CommandType.RENAME, id: 'r1', title: 'Renamed' });

    // the optimistic model already is the confirmed one, so the store was not told twice
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(state.model.version).toBe(1);
    expect(state.model.requests.get('r1')!.title).toBe('Renamed');
    // the fast path must not leave the state unable to follow later updates
    await main.dispatch(foreign({ type: CommandType.RENAME, id: 'r2', title: 'Other' }));
    expect(state.model.version).toBe(2);
    expect(state.model.requests.get('r2')!.title).toBe('Other');
  });

  it('rebases pending commands onto foreign patches', async () => {
    let release!: () => Promise<void>;
    // a fresh main, so the state from beforeEach does not receive every event a second time
    main = new FakeCollectionMain(makeModel());
    state = new CollectionState(
      structuredClone(main.model),
      (envelope) =>
        new Promise((resolve) => (release = () => main.dispatch(envelope).then(resolve))),
      () => main.getCollectionState(),
      onChange
    );
    main.onEvent((event) => state.receive(event));
    const pending = state.dispatch({ type: CommandType.RENAME, id: 'r1', title: 'Mine' });

    await main.dispatch(foreign({ type: CommandType.RENAME, id: 'r2', title: 'Theirs' }));
    expect(state.model.requests.get('r2')!.title).toBe('Theirs');
    expect(state.model.requests.get('r1')!.title).toBe('Mine');

    await release();
    await pending;
    expect(state.model.version).toBe(2);
    expect(state.model.requests.get('r1')!.title).toBe('Mine');
  });

  it('drops pending commands that no longer apply after foreign patches', async () => {
    main.broadcast = false;
    const pending = state.dispatch({ type: CommandType.RENAME, id: 'r1', title: 'Mine' });
    main.broadcast = true;
    main.model = makeModel();

    await main.dispatch(foreign({ type: CommandType.DELETE, ids: ['r1'] }));

    expect(state.model.requests.has('r1')).toBe(false);
    await pending;
  });

  it('resyncs when a version is skipped', async () => {
    const snapshot = vi.spyOn(main, 'getCollectionState');
    main.broadcast = false;
    await main.dispatch(foreign({ type: CommandType.RENAME, id: 'r2', title: 'Missed' }, 'a'));
    main.broadcast = true;
    await main.dispatch(foreign({ type: CommandType.RENAME, id: 'r3', title: 'Seen' }, 'b'));
    await vi.waitFor(() => expect(state.model.version).toBe(2));

    expect(snapshot).toHaveBeenCalledOnce();
    expect(state.model.requests.get('r2')!.title).toBe('Missed');
    expect(state.model.requests.get('r3')!.title).toBe('Seen');
  });

  it('does not re-apply a command that main confirmed during a resync', async () => {
    main = new FakeCollectionMain(makeModel());
    let releaseSnapshot!: () => void;
    const snapshot = vi.fn(() =>
      new Promise<void>((resolve) => (releaseSnapshot = resolve)).then(() =>
        main.getCollectionState()
      )
    );
    state = new CollectionState(
      structuredClone(main.model),
      (envelope) => main.dispatch(envelope),
      snapshot,
      onChange
    );
    main.onEvent((event) => state.receive(event));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const resync = state.resync();

    const copied = state.dispatch({
      type: CommandType.COPY,
      ids: ['r3'],
      idMap: { r3: 'r3-copy' },
    });
    expect(state.model.requests.has('r3-copy')).toBe(true);
    await vi.waitFor(() => expect(main.model.requests.has('r3-copy')).toBe(true));

    releaseSnapshot();
    await Promise.all([copied, resync]);

    expect(snapshot).toHaveBeenCalledOnce();
    expect(warn).not.toHaveBeenCalled();
    expect(state.model.version).toBe(1);
    expect(state.model.requests.has('r3-copy')).toBe(true);
    expect(state.model.childIds.get('col')).toEqual(['f1', 'r3', 'r3-copy']);
    warn.mockRestore();
  });

  it('drops a rejected command, resyncs and rethrows', async () => {
    const snapshot = vi.spyOn(main, 'getCollectionState');
    main.rejectNext = new Error('invalid');

    await expect(
      state.dispatch({ type: CommandType.RENAME, id: 'r1', title: 'Renamed' })
    ).rejects.toThrow('invalid');

    expect(snapshot).toHaveBeenCalledOnce();
    expect(state.model.requests.get('r1')!.title).toBe('r1');
  });

  it('clears pending commands when a snapshot arrives', () => {
    main.broadcast = false;
    void state.dispatch({ type: CommandType.RENAME, id: 'r1', title: 'Renamed' });
    const other = makeModel({ id: 'other' });

    state.receive({ kind: 'snapshot', model: other });

    expect(state.model).toBe(other);
  });

  it('resyncs if main resolves a command without broadcasting it', async () => {
    main.broadcast = false;
    await state.dispatch({ type: CommandType.RENAME, id: 'r1', title: 'Renamed' });

    expect(state.model.version).toBe(1);
    expect(state.model.requests.get('r1')!.title).toBe('Renamed');
  });
});
