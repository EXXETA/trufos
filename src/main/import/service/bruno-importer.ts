import { CollectionImporter } from './import-service';
import { Collection as TrufosCollection } from 'shim/objects/collection';
import { Folder as TrufosFolder } from 'shim/objects/folder';
import { RequestBody, RequestBodyType, TrufosRequest } from 'shim/objects/request';
import { RequestMethod } from 'shim/objects/request-method';
import path from 'node:path';
import fs from 'node:fs/promises';
import { exists } from 'main/util/fs-util';
import { InternalError, InternalErrorType } from 'main/error/internal-error';
import { VARIABLE_NAME_REGEX, VariableObject } from 'shim/objects/variables';
import { randomUUID } from 'node:crypto';
import { CollectionType } from 'shim/objects/collection';

interface BrunoCollectionConfig {
  name: string;
  type: 'collection';
  version?: string;
}

interface BruRequest {
  http?: {
    method: string;
    url: string;
    headers?: Record<string, string>;
    queryParams?: Record<string, string>;
    body?: {
      type?: string;
      data?: string;
      formData?: Record<string, string>;
    };
  };
  meta?: {
    name?: string;
  };
}

/**
 * An importer for Bruno collections. It will import the collection and all of its variables,
 * folders and requests from a Bruno collection directory structure.
 */
export class BrunoImporter implements CollectionImporter {
  public readonly type = CollectionType.Bruno;

  public async importCollection(srcFilePath: string, targetDirPath: string) {
    // Validate that srcFilePath is a directory containing a Bruno collection
    const stats = await fs.stat(srcFilePath);
    if (!stats.isDirectory()) {
      throw new InternalError(
        InternalErrorType.COLLECTION_LOAD_ERROR,
        `Bruno collections must be directories, but "${srcFilePath}" is not a directory`
      );
    }

    // Check for bruno.json file or .bru files
    const brunoConfigPath = path.join(srcFilePath, 'bruno.json');
    let brunoConfig: BrunoCollectionConfig;

    if (await exists(brunoConfigPath)) {
      // Read bruno.json configuration
      brunoConfig = JSON.parse(await fs.readFile(brunoConfigPath, 'utf8')) as BrunoCollectionConfig;
    } else {
      // Check if there are any .bru files in the directory
      const entries = await fs.readdir(srcFilePath, { withFileTypes: true });
      const hasBruFiles =
        entries.some((entry) => entry.isFile() && entry.name.endsWith('.bru')) ||
        entries.some((entry) => entry.isDirectory() && !entry.name.startsWith('.'));

      if (!hasBruFiles) {
        throw new InternalError(
          InternalErrorType.COLLECTION_LOAD_ERROR,
          `No bruno.json file or .bru files found in "${srcFilePath}". This doesn't appear to be a Bruno collection.`
        );
      }

      // Create a default config
      brunoConfig = {
        name: path.basename(srcFilePath),
        type: 'collection',
      };
    }

    // Create collection directory
    const collectionName = brunoConfig.name || path.basename(srcFilePath);
    let dirPath = path.join(targetDirPath, `${collectionName}-imported`);

    // Ensure unique directory name
    let counter = 1;
    while (await exists(dirPath)) {
      dirPath = path.join(targetDirPath, `${collectionName}-imported-${counter}`);
      counter++;
    }

    await fs.mkdir(dirPath, { recursive: true });

    // Load collection variables from environments
    const variables = await this.loadVariables(srcFilePath);
    logger.info('Loaded', Object.keys(variables).length, 'collection variables');

    const collection: TrufosCollection = {
      id: randomUUID(),
      type: 'collection',
      title: brunoConfig.name,
      dirPath: dirPath,
      children: [],
      variables: variables,
      environments: {},
    };

    // Import all items from the Bruno collection directory
    await this.importDirectory(collection, srcFilePath);
    return collection;
  }

  private async loadVariables(collectionPath: string): Promise<Record<string, VariableObject>> {
    const variables: Record<string, VariableObject> = {};

    // Try to load from environments directory
    const environmentsPath = path.join(collectionPath, 'environments');
    if (await exists(environmentsPath)) {
      const envFiles = await fs.readdir(environmentsPath);
      for (const envFile of envFiles) {
        if (envFile.endsWith('.bru')) {
          try {
            const envContent = await fs.readFile(path.join(environmentsPath, envFile), 'utf8');
            const envVars = this.parseEnvironmentVariables(envContent);
            Object.assign(variables, envVars);
          } catch (error) {
            logger.warn(`Failed to parse environment file ${envFile}:`, error);
          }
        }
      }
    }

    // Also check collection.bru for collection-level variables
    const collectionBruPath = path.join(collectionPath, 'collection.bru');
    if (await exists(collectionBruPath)) {
      try {
        const collectionContent = await fs.readFile(collectionBruPath, 'utf8');
        const collectionVars = this.parseCollectionVariables(collectionContent);
        Object.assign(variables, collectionVars);
      } catch (error) {
        logger.warn('Failed to parse collection.bru variables:', error);
      }
    }

    return variables;
  }

  private parseEnvironmentVariables(content: string): Record<string, VariableObject> {
    const variables: Record<string, VariableObject> = {};

    // Parse Bruno environment variables which are in vars { } blocks
    const lines = content.split('\n');
    let inVarsBlock = false;

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed === 'vars {') {
        inVarsBlock = true;
        continue;
      }

      if (trimmed === '}' && inVarsBlock) {
        inVarsBlock = false;
        continue;
      }

      if (inVarsBlock && trimmed && !trimmed.startsWith('#') && trimmed.includes(':')) {
        const colonIndex = trimmed.indexOf(':');
        const key = trimmed.substring(0, colonIndex).trim();
        const value = trimmed.substring(colonIndex + 1).trim();

        if (key && value) {
          const cleanValue = value.replace(/^['"]|['"]$/g, ''); // Remove quotes

          if (VARIABLE_NAME_REGEX.test(key)) {
            variables[key] = { value: cleanValue };
          }
        }
      }
    }

    return variables;
  }

  private parseCollectionVariables(content: string): Record<string, VariableObject> {
    const variables: Record<string, VariableObject> = {};

    // Parse vars:pre-request blocks in collection.bru
    const lines = content.split('\n');
    let inVarsPreRequestBlock = false;

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed === 'vars:pre-request {') {
        inVarsPreRequestBlock = true;
        continue;
      }

      if (trimmed === '}' && inVarsPreRequestBlock) {
        inVarsPreRequestBlock = false;
        continue;
      }

      if (inVarsPreRequestBlock && trimmed && !trimmed.startsWith('#') && trimmed.includes(':')) {
        const colonIndex = trimmed.indexOf(':');
        const key = trimmed.substring(0, colonIndex).trim();
        const value = trimmed.substring(colonIndex + 1).trim();

        if (key && value) {
          const cleanValue = value.replace(/^['"]|['"]$/g, ''); // Remove quotes

          if (VARIABLE_NAME_REGEX.test(key)) {
            variables[key] = { value: cleanValue };
          }
        }
      }
    }

    return variables;
  }

  private async importDirectory(parent: TrufosCollection | TrufosFolder, dirPath: string) {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        // Skip special directories
        if (
          entry.name === 'environments' ||
          entry.name === 'node_modules' ||
          entry.name.startsWith('.')
        ) {
          continue;
        }
        await this.importFolder(parent, fullPath, entry.name);
      } else if (entry.isFile() && entry.name.endsWith('.bru')) {
        await this.importRequest(parent, fullPath);
      }
      // Skip other files like bruno.json, package.json, etc.
    }
  }

  private async importFolder(
    parent: TrufosCollection | TrufosFolder,
    folderPath: string,
    folderName: string
  ) {
    const folder: TrufosFolder = {
      id: randomUUID(),
      parentId: parent.id,
      type: 'folder',
      title: folderName,
      children: [],
    };

    await this.importDirectory(folder, folderPath);
    parent.children.push(folder);
  }

  private async importRequest(parent: TrufosCollection | TrufosFolder, filePath: string) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const bruRequest = this.parseBruFile(content);

      if (!bruRequest.http) {
        logger.warn(`No HTTP section found in ${filePath}, skipping`);
        return;
      }

      const fileName = path.basename(filePath, '.bru');
      const requestName = bruRequest.meta?.name || fileName;

      let bodyInfo: RequestBody | null = null;
      if (bruRequest.http.body) {
        switch (bruRequest.http.body.type) {
          case 'json':
            bodyInfo = {
              type: RequestBodyType.TEXT,
              text: bruRequest.http.body.data || '',
              mimeType: 'application/json',
            };
            break;
          case 'xml':
            bodyInfo = {
              type: RequestBodyType.TEXT,
              text: bruRequest.http.body.data || '',
              mimeType: 'application/xml',
            };
            break;
          case 'text':
            bodyInfo = {
              type: RequestBodyType.TEXT,
              text: bruRequest.http.body.data || '',
              mimeType: 'text/plain',
            };
            break;
          case 'multipart':
            // For multipart forms, convert the form fields to text representation
            if (bruRequest.http.body.formData) {
              const formFields = Object.entries(bruRequest.http.body.formData)
                .map(([key, value]) => `${key}: ${value}`)
                .join('\n');
              bodyInfo = {
                type: RequestBodyType.TEXT,
                text: formFields,
                mimeType: 'multipart/form-data',
              };
            } else if (bruRequest.http.body.data) {
              bodyInfo = {
                type: RequestBodyType.TEXT,
                text: bruRequest.http.body.data,
                mimeType: 'multipart/form-data',
              };
            }
            break;
          // Add more body types as needed
        }
      }

      const headers = bruRequest.http.headers
        ? Object.entries(bruRequest.http.headers).map(([key, value]) => ({
            key,
            value,
            isActive: true,
          }))
        : [];

      const queryParams = bruRequest.http.queryParams
        ? Object.entries(bruRequest.http.queryParams).map(([key, value]) => ({
            key,
            value,
            isActive: true,
          }))
        : [];

      const trufosRequest: TrufosRequest = {
        id: randomUUID(),
        parentId: parent.id,
        type: 'request',
        title: requestName,
        url: bruRequest.http.url,
        method: (bruRequest.http.method.toUpperCase() as RequestMethod) || RequestMethod.GET,
        headers,
        queryParams,
        body: bodyInfo,
      };

      parent.children.push(trufosRequest);
    } catch (error) {
      logger.warn(`Failed to parse Bruno request file ${filePath}:`, error);
    }
  }

  private parseBruFile(content: string): BruRequest {
    const result: BruRequest = {};

    // Parse Bruno .bru files which have sections like:
    // meta { name: "request name" }
    // get { url: "{{baseUrl}}/endpoint" }
    // headers { key: value }
    // etc.

    const lines = content.split('\n');
    let currentSection: string | null = null;
    let currentObject: any = null;
    let braceDepth = 0;
    let inMultilineString = false;
    let multilineContent = '';
    let bodyContent: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) {
        continue;
      }

      // Handle multiline strings
      if (trimmed === "'''") {
        if (inMultilineString) {
          // End of multiline string
          if (
            currentSection &&
            currentSection.startsWith('body') &&
            result.http &&
            result.http.body
          ) {
            result.http.body.data = multilineContent.trim();
          }
          inMultilineString = false;
          multilineContent = '';
        } else {
          // Start of multiline string
          inMultilineString = true;
        }
        continue;
      }

      if (inMultilineString) {
        multilineContent += line + '\n';
        continue;
      }

      // Count braces to track nesting
      const openBraces = (line.match(/{/g) || []).length;
      const closeBraces = (line.match(/}/g) || []).length;
      braceDepth += openBraces - closeBraces;

      // Parse section headers like "meta {", "get {", "headers {"
      if (trimmed.includes('{') && braceDepth === 1) {
        const sectionName = trimmed.replace(/\s*{.*/, '').trim();
        currentSection = sectionName;

        // Save any collected body content from previous section
        if (bodyContent.length > 0 && result.http && result.http.body) {
          result.http.body.data = bodyContent.join('\n').trim();
          bodyContent = [];
        }

        // Initialize section objects
        if (sectionName === 'meta') {
          result.meta = {};
          currentObject = result.meta;
        } else if (
          ['get', 'post', 'put', 'delete', 'patch', 'head', 'options'].includes(
            sectionName.toLowerCase()
          )
        ) {
          result.http = {
            method: sectionName.toUpperCase(),
            url: '',
          };
          currentObject = result.http;
        } else if (sectionName === 'headers') {
          if (!result.http) result.http = { method: 'GET', url: '' };
          result.http.headers = {};
          currentObject = result.http.headers;
        } else if (sectionName === 'params:query') {
          // Handle query parameters
          if (!result.http) result.http = { method: 'GET', url: '' };
          result.http.queryParams = {};
          currentObject = result.http.queryParams;
        } else if (sectionName === 'body' || sectionName.startsWith('body:')) {
          if (!result.http) result.http = { method: 'GET', url: '' };
          if (!result.http.body) result.http.body = { type: 'text', data: '' };

          // Determine body type from section name
          if (sectionName === 'body:multipart-form') {
            result.http.body.type = 'multipart';
            result.http.body.formData = {}; // Store form fields as key-value pairs
            currentObject = result.http.body.formData;
          } else if (sectionName === 'body:json') {
            result.http.body.type = 'json';
            currentObject = null; // We'll collect content in bodyContent array
          } else if (sectionName === 'body:xml') {
            result.http.body.type = 'xml';
            currentObject = null; // We'll collect content in bodyContent array
          } else {
            result.http.body.type = 'text';
            currentObject = null; // We'll collect content in bodyContent array
          }
        }
      } else if (trimmed === '}') {
        // End of section
        if (braceDepth === 0) {
          // Save any collected body content
          if (bodyContent.length > 0 && result.http && result.http.body) {
            result.http.body.data = bodyContent.join('\n').trim();
            bodyContent = [];
          }

          currentSection = null;
          currentObject = null;
        }
      } else if (
        currentSection &&
        currentSection.startsWith('body') &&
        currentObject === null &&
        braceDepth === 1
      ) {
        // Collect body content for JSON, XML, text bodies
        if (trimmed) {
          bodyContent.push(line);
        }
      } else if (currentSection && currentObject && trimmed.includes(':') && braceDepth === 1) {
        // Parse key-value pairs within sections
        const colonIndex = trimmed.indexOf(':');
        let key = trimmed.substring(0, colonIndex).trim();
        let value = trimmed.substring(colonIndex + 1).trim();

        // Remove optional prefix (~) from keys
        if (key.startsWith('~')) {
          key = key.substring(1);
        }

        // Clean up values (remove quotes, trailing commas)
        value = value.replace(/^['"]|['"]$/g, '').replace(/,$/, '');

        if (key && value) {
          // Handle special cases for Bruno format
          if (key === 'body' && value === 'none') {
            // Skip body: none - means no body
            continue;
          } else if (key === 'auth' && value === 'none') {
            // Skip auth: none - means no authentication
            continue;
          } else if (
            key === 'body' &&
            ['json', 'xml', 'text', 'multipartForm', 'formUrlEncoded'].includes(value)
          ) {
            // Handle body type declarations like body: json, body: multipartForm
            if (!result.http) result.http = { method: 'GET', url: '' };
            if (!result.http.body) result.http.body = { type: 'text', data: '' };

            // Map Bruno body types to our format
            if (value === 'multipartForm') {
              result.http.body.type = 'multipart';
            } else {
              result.http.body.type = value;
            }
            continue;
          } else {
            currentObject[key] = value;
          }
        } else if (key && !value) {
          // Handle keys without values (like empty query params)
          currentObject[key] = '';
        }
      }
    }

    // Save any remaining body content
    if (bodyContent.length > 0 && result.http && result.http.body) {
      result.http.body.data = bodyContent.join('\n').trim();
    }

    return result;
  }

  private getMimeTypeFromBodyType(bodyType: string): string {
    switch (bodyType) {
      case 'json':
        return 'application/json';
      case 'xml':
        return 'application/xml';
      case 'text':
        return 'text/plain';
      default:
        return 'text/plain';
    }
  }
}
