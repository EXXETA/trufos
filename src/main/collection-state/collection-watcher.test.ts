import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CollectionWatcher,
  IsIgnored,
  OnFilesChanged,
  WATCH_DEBOUNCE_MS,
} from './collection-watcher';

const dirPath = path.join('/collections', 'first');
const otherDirPath = path.join('/collections', 'second');

let onFilesChanged: ReturnType<typeof vi.fn<OnFilesChanged>>;
let isIgnored: ReturnType<typeof vi.fn<IsIgnored>>;
let watcher: CollectionWatcher;

/** Writes a file of the collection, given relative to its directory. */
const write = (fileName: string) => {
  const filePath = path.join(dirPath, fileName);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, 'content');
};

describe('CollectionWatcher', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    fs.mkdirSync(dirPath, { recursive: true });
    fs.mkdirSync(otherDirPath, { recursive: true });
    onFilesChanged = vi.fn<OnFilesChanged>();
    isIgnored = vi.fn<IsIgnored>((relativePath) => relativePath.startsWith('ignored'));
    watcher = new CollectionWatcher(onFilesChanged, isIgnored);
  });

  afterEach(() => {
    watcher.close();
    vi.useRealTimers();
  });

  it('watches the directory recursively without keeping the app alive', () => {
    const watch = vi.spyOn(fs, 'watch');

    watcher.watch(dirPath);

    expect(watch).toHaveBeenCalledWith(
      dirPath,
      { recursive: true, persistent: false },
      expect.any(Function)
    );
  });

  it('reports the changes together once no change came for a while', () => {
    watcher.watch(dirPath);

    write(path.join('r1', 'request.json'));
    vi.advanceTimersByTime(WATCH_DEBOUNCE_MS - 1);
    write(path.join('r1', 'request-body.txt'));
    vi.advanceTimersByTime(WATCH_DEBOUNCE_MS - 1);
    expect(onFilesChanged).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onFilesChanged).toHaveBeenCalledOnce();
    const [{ filePaths, unnamed }] = onFilesChanged.mock.calls[0];
    expect(unnamed).toBe(false);
    expect(filePaths).toEqual(
      expect.arrayContaining([
        path.join(dirPath, 'r1', 'request.json'),
        path.join(dirPath, 'r1', 'request-body.txt'),
      ])
    );
    expect(new Set(filePaths).size).toBe(filePaths.length);
  });

  it('reports a change without a file name together with the named ones', () => {
    const watch = vi.spyOn(fs, 'watch');
    watcher.watch(dirPath);
    const fsWatcher = watch.mock.results[0].value as fs.FSWatcher;

    fsWatcher.emit('change', 'rename', null);
    write('order.json');
    vi.advanceTimersByTime(WATCH_DEBOUNCE_MS);

    expect(onFilesChanged).toHaveBeenCalledExactlyOnceWith({
      filePaths: [path.join(dirPath, 'order.json')],
      unnamed: true,
    });
  });

  it('reports a change without a file name only once', () => {
    const watch = vi.spyOn(fs, 'watch');
    watcher.watch(dirPath);
    const fsWatcher = watch.mock.results[0].value as fs.FSWatcher;

    fsWatcher.emit('change', 'rename', null);
    vi.advanceTimersByTime(WATCH_DEBOUNCE_MS);
    write('order.json');
    vi.advanceTimersByTime(WATCH_DEBOUNCE_MS);

    expect(onFilesChanged).toHaveBeenNthCalledWith(2, {
      filePaths: [path.join(dirPath, 'order.json')],
      unnamed: false,
    });
  });

  it('does not report the files the rule ignores', () => {
    watcher.watch(dirPath);

    write(path.join('ignored', 'request.json'));
    vi.advanceTimersByTime(WATCH_DEBOUNCE_MS);

    expect(onFilesChanged).not.toHaveBeenCalled();
    expect(isIgnored).toHaveBeenCalledWith(path.join('ignored', 'request.json'));
  });

  it('stops watching the previous directory and drops its changes', () => {
    watcher.watch(dirPath);
    write('order.json');

    watcher.watch(otherDirPath);
    write('order.json');
    vi.advanceTimersByTime(WATCH_DEBOUNCE_MS);

    expect(onFilesChanged).not.toHaveBeenCalled();
  });

  it('stops watching if the watcher fails', () => {
    const watch = vi.spyOn(fs, 'watch');
    watcher.watch(dirPath);
    const fsWatcher = watch.mock.results[0].value as fs.FSWatcher;

    fsWatcher.emit('error', new Error('ENOSPC'));
    write('order.json');
    vi.advanceTimersByTime(WATCH_DEBOUNCE_MS);

    expect(onFilesChanged).not.toHaveBeenCalled();
  });

  it('keeps working if the directory cannot be watched', () => {
    expect(() => watcher.watch(path.join('/collections', 'missing'))).not.toThrow();
  });
});
