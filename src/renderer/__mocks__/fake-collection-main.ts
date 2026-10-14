import {
  applyCommandWithPatches,
  CollectionModel,
  CollectionStateEvent,
  CommandEnvelope,
  normalizeCollection,
} from 'shim/collection-model';
import { Collection } from 'shim/objects/collection';
import { Folder } from 'shim/objects/folder';
import { RequestBodyType, TrufosRequest } from 'shim/objects/request';
import { RequestMethod } from 'shim/objects/request-method';
import { parseUrl } from 'shim/objects/url';

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

  constructor(public model: CollectionModel) {}

  /** Implements `IEventService.dispatch`. */
  dispatch = async (envelope: CommandEnvelope): Promise<void> => {
    this.received.push(envelope);
    if (this.rejectNext != null) {
      const error = this.rejectNext;
      this.rejectNext = undefined;
      throw error;
    }
    const [model, patches] = applyCommandWithPatches(this.model, envelope);
    this.model = model;
    if (this.broadcast) {
      this.emit({
        kind: 'patches',
        version: model.version,
        patches,
        commandId: envelope.commandId,
      });
    }
  };

  /** Implements `IEventService.getCollectionState`. */
  getCollectionState = async (): Promise<CollectionModel> => structuredClone(this.model);

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

export function makeRequest(
  id: string,
  parentId: string,
  overrides: Partial<TrufosRequest> = {}
): TrufosRequest {
  return {
    id,
    parentId,
    type: 'request',
    lastModified: 0,
    title: id,
    url: parseUrl('http://localhost'),
    method: RequestMethod.GET,
    headers: [],
    body: { type: RequestBodyType.TEXT, mimeType: 'text/plain' },
    draft: false,
    ...overrides,
  };
}

export function makeFolder(
  id: string,
  parentId: string,
  children: Folder['children'] = []
): Folder {
  return { id, parentId, type: 'folder', lastModified: 0, title: id, children };
}

export function makeCollection(
  id: string,
  children: Collection['children'] = [],
  overrides: Partial<Collection> = {}
): Collection {
  return {
    id,
    type: 'collection',
    title: 'Test',
    dirPath: `/${id}`,
    lastModified: 0,
    variables: {},
    environments: {},
    children,
    ...overrides,
  };
}

/**
 * col
 * ├── f1
 * │   ├── r1
 * │   └── f2
 * │       └── r2
 * └── r3
 */
export function makeModel(overrides: Partial<Collection> = {}): CollectionModel {
  return normalizeCollection(
    makeCollection(
      'col',
      [
        makeFolder('f1', 'col', [
          makeRequest('r1', 'f1'),
          makeFolder('f2', 'f1', [makeRequest('r2', 'f2')]),
        ]),
        makeRequest('r3', 'col'),
      ],
      overrides
    )
  );
}
