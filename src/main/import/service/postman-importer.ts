import { CollectionImporter } from './import-service';
import { Collection } from 'main/persistence/entity/collection';
import {
  DirectoryWithInfo,
  DirectoryWithInfoType
} from 'main/persistence/entity/directory-with-info';
import {
  Collection as PostmanCollection,
  CollectionDefinition,
  Item,
  ItemGroup
} from 'postman-collection';
import path from 'node:path';
import fs from 'node:fs/promises';
import { VariableObject } from 'main/environment/entity/variable';
import { Request } from 'main/persistence/entity/request';
import { RequestBody, RequestMethod } from 'shim/http';
import { Folder } from 'main/persistence/entity/folder';
import { exists } from 'main/util/fs-util';
import { InternalError, InternalErrorType } from 'main/error/internal-error';
import { VARIABLE_NAME_REGEX } from 'shim/variables';

/**
 * An importer for Postman collections. It will import the collection and all of its variables,
 * folders and requests. It imports using the DFS algorithm.
 */
export class PostmanImporter implements CollectionImporter {

  public async importCollection(srcFilePath: string, targetDirPath: string) {

    // read Postman collection
    const json = JSON.parse(await fs.readFile(srcFilePath, 'utf8')) as CollectionDefinition;
    const postmanCollection = new PostmanCollection(json);
    const variables =
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
    console.info('Loaded', variables.length, 'collection variables');

    // create collection directory
    const dirName = path.basename(targetDirPath);
    const dirPath = path.join(targetDirPath, dirName);
    if (await exists(dirPath)) {
      throw new InternalError(InternalErrorType.COLLECTION_LOAD_ERROR, `Directory "${dirPath}" already exists`);
    } else {
      await fs.mkdir(dirPath);
    }

    const collection = new Collection({
        version: 'v1',
        type: DirectoryWithInfoType.COLLECTION,
        variables: Object.fromEntries(variables),
        title: postmanCollection.name
      },
      dirName,
      path.dirname(targetDirPath)
    );

    // import children
    await this.importItems(collection, postmanCollection.items.all());
    return collection;
  }

  private async importItems(parent: DirectoryWithInfo, items: (Item | ItemGroup<Item>)[]) {
    for (const item of items) {
      if (item instanceof ItemGroup) {
        await this.importFolder(parent, item);
      } else if (item instanceof Item) {
        await this.importRequest(parent, item);
      }
    }
  }

  private async importFolder(parent: DirectoryWithInfo, postmanFolder: ItemGroup<Item>) {
    const folder = new Folder({
        version: 'v1',
        title: postmanFolder.name,
        type: DirectoryWithInfoType.FOLDER
      },
      postmanFolder.id,
      parent
    );

    await this.importItems(folder, postmanFolder.items.all());
    parent.addChild(folder);
  }

  private async importRequest(parent: DirectoryWithInfo, item: Item) {
    const { request } = item;
    let bodyInfo: RequestBody | null = null;
    if (request.body !== undefined) {
      switch (request.body.mode) {
        case 'file':
          bodyInfo = {
            type: 'file',
            filePath: request.body.file.src
          };
          break;
        case 'raw':
          bodyInfo = {
            type: 'text',
            text: request.body.raw,
            mimeType: request.headers.get('Content-Type') ?? 'text/plain'
          };
          break;
      }
    }

    parent.addChild(
      new Request({
          version: 'v1',
          title: item.name,
          type: DirectoryWithInfoType.REQUEST,
          url: request.url.toString(),
          method: request.method as RequestMethod,
          headers: Object.fromEntries(request.headers.all().map(header => [header.key, header.value])),
          bodyInfo
        },
        item.id,
        parent
      )
    );
  }
}
