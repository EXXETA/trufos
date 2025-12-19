import { CollectionImporter } from './import-service';
import { Collection as TrufosCollection } from 'shim/objects/collection';
import { Folder as TrufosFolder } from 'shim/objects/folder';
import { RequestBody, RequestBodyType, TrufosRequest } from 'shim/objects/request';
import { parseUrl } from 'shim/objects/url';
import { RequestMethod } from 'shim/objects/request-method';
import fs from 'node:fs/promises';
import path from 'node:path';
import { VARIABLE_NAME_REGEX, VariableObject } from 'shim/objects/variables';

const DEFAULT_MIME_TYPE = 'text/plain';

export class BrunoImporter implements CollectionImporter {
  public async importCollection(srcDirPath: string) {
    const brunoJsonPath = path.join(srcDirPath, 'bruno.json');
    let collectionName = path.basename(srcDirPath);
    let environments: Record<string, { variables: Record<string, VariableObject> }> = {};

    if (await this.fileExists(brunoJsonPath)) {
      const brunoJson = JSON.parse(await fs.readFile(brunoJsonPath, 'utf8'));
      collectionName = brunoJson.name || collectionName;
    }

    const environmentsDir = path.join(srcDirPath, 'environments');
    if (await this.fileExists(environmentsDir)) {
      environments = await this.loadEnvironments(environmentsDir);
    }

    const collectionId = this.generateId();
    const collection: TrufosCollection = {
      id: collectionId,
      type: 'collection',
      title: collectionName,
      dirPath: '',
      children: [],
      variables: {},
      environments,
    };

    await this.importDirectory(srcDirPath, collection, collectionId);
    return collection;
  }

  private async importDirectory(
    dirPath: string,
    parent: TrufosCollection | TrufosFolder,
    parentId: string
  ) {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        if (entry.name === 'environments' || entry.name === 'node_modules') {
          continue;
        }

        const folder: TrufosFolder = {
          id: this.generateId(),
          parentId,
          type: 'folder',
          title: entry.name,
          children: [],
        };

        await this.importDirectory(fullPath, folder, folder.id);
        parent.children.push(folder);
      } else if (entry.isFile() && entry.name.endsWith('.bru')) {
        const request = await this.parseBruFile(fullPath, parentId);
        if (request) {
          parent.children.push(request);
        }
      }
    }
  }

  private async parseBruFile(filePath: string, parentId: string): Promise<TrufosRequest | null> {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const lines = content.split('\n');

      let method: RequestMethod = RequestMethod.GET;
      let url = '';
      const headers: TrufosRequest['headers'] = [];
      let bodyContent = '';
      let mimeType = DEFAULT_MIME_TYPE;
      let currentSection: string | null = null;
      let captureBody = false;

      for (const line of lines) {
        const trimmedLine = line.trim();

        if (trimmedLine.startsWith('meta {')) {
          currentSection = 'meta';
          continue;
        } else if (trimmedLine.startsWith('headers {')) {
          currentSection = 'headers';
          continue;
        } else if (trimmedLine.startsWith('body {')) {
          currentSection = 'body';
          continue;
        } else if (trimmedLine.match(/^get\s*\{/)) {
          method = RequestMethod.GET;
          currentSection = 'get';
          continue;
        } else if (trimmedLine.match(/^post\s*\{/)) {
          method = RequestMethod.POST;
          currentSection = 'post';
          continue;
        } else if (trimmedLine.match(/^put\s*\{/)) {
          method = RequestMethod.PUT;
          currentSection = 'put';
          continue;
        } else if (trimmedLine.match(/^delete\s*\{/)) {
          method = RequestMethod.DELETE;
          currentSection = 'delete';
          continue;
        } else if (trimmedLine.match(/^patch\s*\{/)) {
          method = RequestMethod.PATCH;
          currentSection = 'patch';
          continue;
        } else if (trimmedLine.match(/^head\s*\{/)) {
          method = RequestMethod.HEAD;
          currentSection = 'head';
          continue;
        } else if (trimmedLine.match(/^options\s*\{/)) {
          method = RequestMethod.OPTIONS;
          currentSection = 'options';
          continue;
        } else if (trimmedLine.startsWith('body:json {')) {
          currentSection = 'body:json';
          mimeType = 'application/json';
          captureBody = true;
          continue;
        } else if (trimmedLine.startsWith('body:text {')) {
          currentSection = 'body:text';
          mimeType = 'text/plain';
          captureBody = true;
          continue;
        } else if (trimmedLine.startsWith('body:xml {')) {
          currentSection = 'body:xml';
          mimeType = 'application/xml';
          captureBody = true;
          continue;
        } else if (trimmedLine === '}') {
          if (captureBody) {
            captureBody = false;
          }
          currentSection = null;
          continue;
        }

        if (
          currentSection === 'get' ||
          currentSection === 'post' ||
          currentSection === 'put' ||
          currentSection === 'delete' ||
          currentSection === 'patch' ||
          currentSection === 'head' ||
          currentSection === 'options'
        ) {
          if (trimmedLine.startsWith('url:')) {
            url = trimmedLine.substring(4).trim();
          } else if (!trimmedLine.startsWith('}') && !url) {
            url = trimmedLine;
          }
        } else if (currentSection === 'headers' && trimmedLine && !trimmedLine.startsWith('}')) {
          const colonIndex = trimmedLine.indexOf(':');
          if (colonIndex > 0) {
            const key = trimmedLine.substring(0, colonIndex).trim();
            const value = trimmedLine.substring(colonIndex + 1).trim();
            headers.push({ key, value, isActive: true });
          }
        } else if (captureBody && trimmedLine !== '}') {
          bodyContent += line + '\n';
        }
      }

      const fileName = path.basename(filePath, '.bru');
      let requestBody: RequestBody;

      if (bodyContent.trim()) {
        requestBody = {
          type: RequestBodyType.TEXT,
          text: bodyContent.trim(),
          mimeType,
        };
      } else {
        requestBody = {
          type: RequestBodyType.TEXT,
          mimeType: DEFAULT_MIME_TYPE,
        };
      }

      return {
        id: this.generateId(),
        parentId,
        type: 'request',
        title: fileName,
        url: parseUrl(url || 'http://'),
        method,
        headers,
        body: requestBody,
      };
    } catch (error) {
      logger.warn(`Failed to parse Bruno file ${filePath}:`, error);
      return null;
    }
  }

  private async loadEnvironments(
    environmentsDir: string
  ): Promise<Record<string, { variables: Record<string, VariableObject> }>> {
    const environments: Record<string, { variables: Record<string, VariableObject> }> = {};

    try {
      const files = await fs.readdir(environmentsDir);
      files.sort();

      for (const file of files) {
        if (file.endsWith('.bru')) {
          const filePath = path.join(environmentsDir, file);
          const content = await fs.readFile(filePath, 'utf8');
          const envName = path.basename(file, '.bru');
          const variables = this.parseEnvironmentVariables(content);

          if (Object.keys(variables).length > 0) {
            environments[envName] = { variables };
          }
        }
      }
    } catch (error) {
      logger.warn(`Failed to load environments from ${environmentsDir}:`, error);
    }

    return environments;
  }

  private parseEnvironmentVariables(content: string): Record<string, VariableObject> {
    const variables: Record<string, VariableObject> = {};
    const lines = content.split('\n');
    let inVarsSection = false;

    for (const line of lines) {
      const trimmedLine = line.trim();

      if (trimmedLine.startsWith('vars {')) {
        inVarsSection = true;
        continue;
      } else if (trimmedLine === '}') {
        inVarsSection = false;
        continue;
      }

      if (inVarsSection && trimmedLine && !trimmedLine.startsWith('//')) {
        const colonIndex = trimmedLine.indexOf(':');
        if (colonIndex > 0) {
          const key = trimmedLine.substring(0, colonIndex).trim();
          const value = trimmedLine.substring(colonIndex + 1).trim();

          if (VARIABLE_NAME_REGEX.test(key)) {
            variables[key] = { value };
          }
        }
      }
    }

    return variables;
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private generateId(): string {
    return `bruno_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}
