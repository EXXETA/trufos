import { randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';
import type { Collection } from 'shim/objects/collection';
import type { Folder } from 'shim/objects/folder';
import type { TrufosRequest } from 'shim/objects/request';
import type { ScriptType } from 'shim/scripting';

/**
 * A fully-hydrated, saved-only (drafts excluded) in-memory snapshot of a collection tree. It is the
 * direction-neutral interchange format of Trufos collections: exporters consume snapshots and
 * importers may produce them. Large content (request bodies, scripts) is not buffered eagerly but
 * exposed through lazy methods returning fresh streams.
 *
 * Snapshots are main-process only (Node streams are not IPC-serializable) and detached from the
 * persistence state: modifying a snapshot never affects the collection on disk.
 */
export interface RequestSnapshot extends TrufosRequest {
  /** Opens a fresh stream of the saved request body, or `undefined` when there is none. */
  getBodyContent(): Promise<Readable | undefined>;
  /** Opens a fresh stream of the script of the given type, or `undefined` when it does not exist. */
  getScriptContent(type: ScriptType): Promise<Readable | undefined>;
}

export type SnapshotChild = FolderSnapshot | RequestSnapshot;

export interface FolderSnapshot extends Omit<Folder, 'children'> {
  children: SnapshotChild[];
}

export interface CollectionSnapshot extends Omit<Collection, 'children'> {
  children: SnapshotChild[];
}

/**
 * Assigns fresh IDs to all nodes of the given snapshot, rewiring `parentId` references
 * accordingly. Mutates the snapshot in place (a snapshot cannot be `structuredClone`d because of
 * its function properties). Intended for cloning use cases where importing the result next to the
 * source collection must not create duplicate IDs.
 *
 * The fresh IDs are intentionally unknown to the persistence layer's ID-to-path mapping, so they
 * can never resolve to (and overwrite) the source collection's directories.
 */
export function regenerateIds(snapshot: CollectionSnapshot): void {
  snapshot.id = randomUUID();
  const visit = (children: SnapshotChild[], parentId: string) => {
    for (const child of children) {
      child.id = randomUUID();
      child.parentId = parentId;
      if (child.type === 'folder') {
        visit(child.children, child.id);
      }
    }
  };
  visit(snapshot.children, snapshot.id);
}
