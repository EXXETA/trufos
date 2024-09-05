import { CollectionImporter } from './import-service';
import {
  Collection as PostmanCollection,
  CollectionDefinition,
  Item,
  ItemGroup
} from 'postman-collection';
import { Collection as RufusCollection } from 'shim/objects/collection';
import { Folder as RufusFolder } from 'shim/objects/folder';
import {RequestBody, RequestBodyType, RufusRequest} from 'shim/objects/request';
import {RequestMethod} from "shim/objects/requestMethod";
import path from 'node:path';
import fs from 'node:fs/promises';
import { exists } from 'main/util/fs-util';
import { InternalError, InternalErrorType } from 'main/error/internal-error';
import { VARIABLE_NAME_REGEX, VariableObject } from 'shim/variables';

/**
 * An importer for Postman collections. It will import the collection and all of its variables,
 * folders and requests. It imports using the DFS algorithm.
 */
export class PostmanImporter implements CollectionImporter {

  public async importCollection(srcFilePath: string, targetDirPath: string) {

    // read Postman collection
    const json = JSON.parse(await fs.readFile(srcFilePath, 'utf8')) as CollectionDefinition;
    const postmanCollection = new PostmanCollection(json);
    const variablesArray =
      postmanCollection.variables
      .all()
      .filter(variable => variable.id !== undefined && VARIABLE_NAME_REGEX.test(variable.id))
      .map(variable =>
        [
          variable.id,
          {
            value: variable.toString(),
            enabled: !variable.disabled
          }
        ] as [string, VariableObject]);
    console.info('Loaded', variablesArray.length, 'collection variables');

    // create collection directory
    const dirName = path.basename(targetDirPath);
    const dirPath = path.join(targetDirPath, dirName);
    if (await exists(dirPath)) {
      throw new InternalError(InternalErrorType.COLLECTION_LOAD_ERROR, `Directory "${dirPath}" already exists`);
    } else {
      await fs.mkdir(dirPath);
    }

    const variables: Record<string, VariableObject> = {};
    variablesArray.forEach(([key, val]) => variables[key] = val);

    const collection: RufusCollection = {
      id: postmanCollection.id,
      type: 'collection',
      title: postmanCollection.name,
      dirPath: dirPath,
      children: [],
      variables: variables
    };

    // import children
    await this.importItems(collection, postmanCollection.items.all());
    return collection;
  }

  private async importItems(parent: RufusCollection | RufusFolder, items: (Item | ItemGroup<Item>)[]) {
    for (const item of items) {
      if (item instanceof ItemGroup) {
        await this.importFolder(parent, item);
      } else if (item instanceof Item) {
        await this.importRequest(parent, item);
      }
    }
  }

  private async importFolder(parent: RufusCollection | RufusFolder, postmanFolder: ItemGroup<Item>) {
    const folder: RufusFolder = {
      id: postmanFolder.id,
      parentId: parent.id,
      type: 'folder',
      title: postmanFolder.name,
      children: []
    };

    await this.importItems(folder, postmanFolder.items.all());
    parent.children.push(folder);
  }

  private async importRequest(parent: RufusCollection | RufusFolder, item: Item) {
    const { request } = item;

    let bodyInfo: RequestBody | null = null;
    if (request.body !== undefined) {
      switch (request.body.mode) {
        case 'file':
          bodyInfo = {
            type: RequestBodyType.FILE,
            filePath: request.body.file.src
          };
          break;
        case 'raw':
          bodyInfo = {
            type: RequestBodyType.TEXT,
            text: request.body.raw,
            mimeType: request.headers.get('Content-Type') ?? 'text/plain'
          };
          break;
      }
    }

    const rufusRequest: RufusRequest = {
      id: item.id,
      parentId: parent.id,
      type: 'request',
      title: item.name,
      url: request.url.toString(),
      method: request.method as RequestMethod,
      headers: Object.fromEntries(request.headers.all().map(header => [header.key, header.value])),
      body: bodyInfo
    };

    parent.children.push(rufusRequest);
  }
}
