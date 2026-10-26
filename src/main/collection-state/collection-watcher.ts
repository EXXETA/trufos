import fs from 'node:fs';
import path from 'node:path';

/** How long the watcher waits after the last change before it reports the changes. */
export const WATCH_DEBOUNCE_MS = 300;

/** The changes of the watched collection since the last report. */
export interface FileChanges {
  /** The absolute paths of the changed files the platform named. */
  filePaths: string[];
  /** Whether a change came without a file name, so any file may have changed. */
  unnamed: boolean;
}

/**
 * Reports the changes of the watched collection.
 * @returns optionally a promise of the handling. The watcher does not wait for it, so the handler
 * reports its own failures.
 */
export type OnFilesChanged = (changes: FileChanges) => void | Promise<void>;

/**
 * Decides whether a change of a file is not reported.
 * @param relativePath the path of the file relative to the collection directory
 */
export type IsIgnored = (relativePath: string) => boolean;

/**
 * Watches the directory of the open collection, so changes outside the app, e.g. by git, are
 * noticed while the window has focus as well. Changes are collected and reported together once
 * no change came for {@link WATCH_DEBOUNCE_MS}, so a branch switch that writes many files is
 * reported as few changes. The app's own writes are reported too, except the ignored files; the
 * receiver tells them apart by comparing the files with its state.
 *
 * Watching is a convenience: if the directory cannot be watched, e.g. because the inotify limit of
 * Linux is reached, the failure is logged and the collection is only checked when the window
 * gets focus.
 */
export class CollectionWatcher {
  private watcher?: fs.FSWatcher;
  private readonly changed = new Set<string>();
  private unnamed = false;
  private timer?: NodeJS.Timeout;

  /**
   * @param onFilesChanged receives the changes
   * @param isIgnored decides which files are not watched, e.g. those only the app writes
   */
  constructor(
    private readonly onFilesChanged: OnFilesChanged,
    private readonly isIgnored: IsIgnored
  ) {}

  /**
   * Watches the given collection directory instead of the one watched before. Changes of the
   * previous one that were not reported yet are dropped.
   * @param dirPath the directory of the collection
   */
  public watch(dirPath: string): void {
    this.close();
    try {
      // not persistent, so the watcher does not keep the app from quitting
      this.watcher = fs.watch(dirPath, { recursive: true, persistent: false }, (_, fileName) =>
        this.record(dirPath, fileName)
      );
      this.watcher.on('error', (error) => {
        logger.warn(`Stopped watching the collection at ${dirPath}:`, error);
        this.close();
      });
    } catch (error) {
      logger.warn(`Cannot watch the collection at ${dirPath}:`, error);
    }
  }

  /** Stops watching. Changes that were not reported yet are dropped. */
  public close(): void {
    this.watcher?.close();
    this.watcher = undefined;
    clearTimeout(this.timer);
    this.timer = undefined;
    this.changed.clear();
    this.unnamed = false;
  }

  private record(dirPath: string, fileName: string | null) {
    if (fileName == null) this.unnamed = true;
    else if (this.isIgnored(fileName)) return;
    else this.changed.add(path.join(dirPath, fileName));
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.report(), WATCH_DEBOUNCE_MS);
  }

  private report() {
    const changes: FileChanges = { filePaths: [...this.changed], unnamed: this.unnamed };
    this.changed.clear();
    this.unnamed = false;
    this.timer = undefined;
    void this.onFilesChanged(changes);
  }
}
