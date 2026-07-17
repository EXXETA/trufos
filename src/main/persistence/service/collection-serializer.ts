import { Readable } from 'node:stream';
import { sanitizeTitle } from 'shim/fs';
import { TrufosObject } from 'shim/objects';
import { RequestBodyType, TEXT_BODY_FILE_NAME } from 'shim/objects/request';
import { ScriptType } from 'shim/scripting';
import {
  getInfoFileName,
  getScriptFileName,
  ORDER_FILE_NAME,
  SECRETS_FILE_NAME,
} from 'main/persistence/constants';
import { omit } from 'main/util/object-util';
import {
  extractSecrets,
  GIT_IGNORE_CONTENT,
  GIT_IGNORE_FILE_NAME,
  toInfoFile,
} from './info-files/latest';
import type { CollectionSnapshot, RequestSnapshot, SnapshotChild } from './snapshot';

/** A single file of a serialized collection, e.g. an archive entry or a file to write to disk. */
export interface SerializedEntry {
  /** POSIX-style file path relative to the collection root. */
  path: string;
  data: Readable | string;
}

export interface SerializeOptions {
  /**
   * When true, each node's secrets (secret variables and auth) are emitted as portable plaintext
   * JSON `.secrets.bin` entries. When false (default), secrets are omitted entirely.
   */
  includeSecrets?: boolean;
}

/**
 * Serializes a collection snapshot into the on-disk file layout of a Trufos collection. This is
 * the single owner of that layout outside of {@link PersistenceService} itself: consumers only
 * decide where the entries go (e.g. a ZIP archive, or a directory for a future collection clone).
 *
 * Info files are emitted at the latest schema version, so serialized collections always stay
 * within the info-file migration chain.
 */
export async function* serializeCollection(
  snapshot: CollectionSnapshot,
  options: SerializeOptions = {}
): AsyncGenerator<SerializedEntry> {
  yield { path: GIT_IGNORE_FILE_NAME, data: GIT_IGNORE_CONTENT };
  yield* serializeNode(snapshot, '', options);
}

async function* serializeNode(
  node: CollectionSnapshot | SnapshotChild,
  dirPath: string,
  options: SerializeOptions
): AsyncGenerator<SerializedEntry> {
  const bodyContent = node.type === 'request' ? await node.getBodyContent() : undefined;

  // Detach a deep copy of the plain object so that neither secret extraction nor info-file
  // conversion mutates the snapshot. Children and the lazy content methods must be stripped
  // first: functions cannot be structured-cloned, and both would otherwise leak into the JSON.
  const plain = (
    node.type === 'request'
      ? structuredClone(omit({ ...node }, 'getBodyContent', 'getScriptContent'))
      : { ...structuredClone(omit({ ...node }, 'children')), children: [] }
  ) as TrufosObject;

  // When the body is emitted as its own file, strip any inline text (canonical on-disk form).
  if (bodyContent != null && plain.type === 'request' && plain.body.type === RequestBodyType.TEXT) {
    delete plain.body.text;
  }

  const secrets = extractSecrets(plain);
  yield { path: joinPosix(dirPath, getInfoFileName(node.type)), data: toJson(toInfoFile(plain)) };
  if (options.includeSecrets && Object.keys(secrets).length > 0) {
    yield { path: joinPosix(dirPath, SECRETS_FILE_NAME), data: toJson(secrets) };
  }

  if (node.type === 'request') {
    yield* serializeRequestContent(node, dirPath, bodyContent);
  } else {
    yield* serializeChildren(node.children, dirPath, options);
  }
}

async function* serializeRequestContent(
  request: RequestSnapshot,
  dirPath: string,
  bodyContent: Readable | undefined
): AsyncGenerator<SerializedEntry> {
  if (bodyContent != null) {
    yield { path: joinPosix(dirPath, TEXT_BODY_FILE_NAME), data: bodyContent };
  }
  for (const type of Object.values(ScriptType)) {
    const script = await request.getScriptContent(type);
    if (script != null) {
      yield { path: joinPosix(dirPath, getScriptFileName(type)), data: script };
    }
  }
}

async function* serializeChildren(
  children: SnapshotChild[],
  dirPath: string,
  options: SerializeOptions
): AsyncGenerator<SerializedEntry> {
  if (children.length === 0) return;

  yield {
    path: joinPosix(dirPath, ORDER_FILE_NAME),
    data: toJson(children.map((child) => child.id)),
  };

  // derive directory names from titles, suffixing duplicates just like PersistenceService does
  const usedNames = new Set<string>();
  for (const child of children) {
    const baseName = sanitizeTitle(child.title);
    let name = baseName;
    for (let i = 2; name === '' || usedNames.has(name); i++) {
      name = `${baseName}-${i}`;
    }
    usedNames.add(name);
    yield* serializeNode(child, joinPosix(dirPath, name), options);
  }
}

function joinPosix(dirPath: string, name: string) {
  return dirPath === '' ? name : `${dirPath}/${name}`;
}

function toJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}
