import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrunoImporter } from './bruno-importer';
import fs from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { TrufosRequest } from 'shim/objects/request';
import { Folder } from 'shim/objects/folder';

vi.mock('main/persistence/service/persistence-service');

describe('BrunoImporter', () => {
  const testDir = path.join(tmpdir(), 'bruno-test-' + Date.now());
  const brunoImporter = new BrunoImporter();

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true });
  });

  it('should import a simple Bruno collection', async () => {
    const collectionDir = path.join(testDir, 'my-bruno-collection');
    await fs.mkdir(collectionDir, { recursive: true });

    const brunoJson = {
      name: 'My Test Collection',
      version: '1',
    };
    await fs.writeFile(path.join(collectionDir, 'bruno.json'), JSON.stringify(brunoJson, null, 2));

    const requestContent = `meta {
  name: Get Users
  type: http
  seq: 1
}

get {
  url: https://api.example.com/users
}

headers {
  Content-Type: application/json
  Authorization: Bearer {{token}}
}
`;

    await fs.writeFile(path.join(collectionDir, 'get-users.bru'), requestContent);

    const result = await brunoImporter.importCollection(collectionDir);

    expect(result.type).toBe('collection');
    expect(result.title).toBe('My Test Collection');
    expect(result.children.length).toBe(1);

    const request = result.children[0] as TrufosRequest;
    expect(request.type).toBe('request');
    expect(request.title).toBe('get-users');
    expect(request.url.base).toBe('https://api.example.com/users');
    expect(request.method).toBe('GET');
    expect(request.headers.length).toBe(2);
    expect(request.headers[0]).toEqual({
      key: 'Content-Type',
      value: 'application/json',
      isActive: true,
    });
    expect(request.headers[1]).toEqual({
      key: 'Authorization',
      value: 'Bearer {{token}}',
      isActive: true,
    });
  });

  it('should import Bruno collection with folders', async () => {
    const collectionDir = path.join(testDir, 'collection-with-folders');
    await fs.mkdir(collectionDir, { recursive: true });

    const brunoJson = {
      name: 'Collection With Folders',
      version: '1',
    };
    await fs.writeFile(path.join(collectionDir, 'bruno.json'), JSON.stringify(brunoJson, null, 2));

    const usersFolder = path.join(collectionDir, 'users');
    await fs.mkdir(usersFolder, { recursive: true });

    const getUsersContent = `get {
  url: https://api.example.com/users
}
`;
    await fs.writeFile(path.join(usersFolder, 'get-users.bru'), getUsersContent);

    const createUserContent = `post {
  url: https://api.example.com/users
}

headers {
  Content-Type: application/json
}

body:json {
  {
    "name": "John Doe",
    "email": "john@example.com"
  }
}
`;
    await fs.writeFile(path.join(usersFolder, 'create-user.bru'), createUserContent);

    const result = await brunoImporter.importCollection(collectionDir);

    expect(result.type).toBe('collection');
    expect(result.title).toBe('Collection With Folders');
    expect(result.children.length).toBe(1);

    const folder = result.children[0] as Folder;
    expect(folder.type).toBe('folder');
    expect(folder.title).toBe('users');
    expect(folder.children.length).toBe(2);

    const getUsersRequest = folder.children[1] as TrufosRequest;
    expect(getUsersRequest.type).toBe('request');
    expect(getUsersRequest.title).toBe('get-users');
    expect(getUsersRequest.method).toBe('GET');

    const createUserRequest = folder.children[0] as TrufosRequest;
    expect(createUserRequest.type).toBe('request');
    expect(createUserRequest.title).toBe('create-user');
    expect(createUserRequest.method).toBe('POST');
    expect(createUserRequest.body.type).toBe('text');
    expect(createUserRequest.body.mimeType).toBe('application/json');
    if (createUserRequest.body.type === 'text') {
      expect(createUserRequest.body.text).toContain('"name": "John Doe"');
    }
  });

  it('should import Bruno environments', async () => {
    const collectionDir = path.join(testDir, 'collection-with-env');
    await fs.mkdir(collectionDir, { recursive: true });

    const brunoJson = {
      name: 'Collection With Environments',
      version: '1',
    };
    await fs.writeFile(path.join(collectionDir, 'bruno.json'), JSON.stringify(brunoJson, null, 2));

    const environmentsDir = path.join(collectionDir, 'environments');
    await fs.mkdir(environmentsDir, { recursive: true });

    const devEnvContent = `vars {
  baseUrl: https://dev.example.com
  apiKey: dev-key-123
  timeout: 5000
}
`;
    await fs.writeFile(path.join(environmentsDir, 'dev.bru'), devEnvContent);

    const prodEnvContent = `vars {
  baseUrl: https://api.example.com
  apiKey: prod-key-456
  timeout: 10000
}
`;
    await fs.writeFile(path.join(environmentsDir, 'prod.bru'), prodEnvContent);

    const result = await brunoImporter.importCollection(collectionDir);

    expect(result.environments).toBeDefined();
    expect(Object.keys(result.environments).length).toBe(2);

    expect(result.environments['dev']).toBeDefined();
    expect(result.environments['dev'].variables['baseUrl'].value).toBe('https://dev.example.com');
    expect(result.environments['dev'].variables['apiKey'].value).toBe('dev-key-123');
    expect(result.environments['dev'].variables['timeout'].value).toBe('5000');

    expect(result.environments['prod']).toBeDefined();
    expect(result.environments['prod'].variables['baseUrl'].value).toBe('https://api.example.com');
    expect(result.environments['prod'].variables['apiKey'].value).toBe('prod-key-456');
    expect(result.environments['prod'].variables['timeout'].value).toBe('10000');
  });

  it('should handle different HTTP methods', async () => {
    const collectionDir = path.join(testDir, 'collection-with-methods');
    await fs.mkdir(collectionDir, { recursive: true });

    const brunoJson = {
      name: 'Collection With Different Methods',
      version: '1',
    };
    await fs.writeFile(path.join(collectionDir, 'bruno.json'), JSON.stringify(brunoJson, null, 2));

    const methods = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options'];

    for (const method of methods) {
      const content = `${method} {
  url: https://api.example.com/test
}
`;
      await fs.writeFile(path.join(collectionDir, `${method}-request.bru`), content);
    }

    const result = await brunoImporter.importCollection(collectionDir);

    expect(result.children.length).toBe(methods.length);

    const sortedMethods = [...methods].sort();
    sortedMethods.forEach((method, index) => {
      const request = result.children[index] as TrufosRequest;
      expect(request.type).toBe('request');
      expect(request.method).toBe(method.toUpperCase());
    });
  });

  it('should handle requests with different body types', async () => {
    const collectionDir = path.join(testDir, 'collection-with-body-types');
    await fs.mkdir(collectionDir, { recursive: true });

    const brunoJson = {
      name: 'Collection With Body Types',
      version: '1',
    };
    await fs.writeFile(path.join(collectionDir, 'bruno.json'), JSON.stringify(brunoJson, null, 2));

    const jsonBodyContent = `post {
  url: https://api.example.com/json
}

body:json {
  {
    "key": "value"
  }
}
`;
    await fs.writeFile(path.join(collectionDir, 'json-body.bru'), jsonBodyContent);

    const textBodyContent = `post {
  url: https://api.example.com/text
}

body:text {
  This is plain text content
}
`;
    await fs.writeFile(path.join(collectionDir, 'text-body.bru'), textBodyContent);

    const xmlBodyContent = `post {
  url: https://api.example.com/xml
}

body:xml {
  <root>
    <item>value</item>
  </root>
}
`;
    await fs.writeFile(path.join(collectionDir, 'xml-body.bru'), xmlBodyContent);

    const result = await brunoImporter.importCollection(collectionDir);

    expect(result.children.length).toBe(3);

    const jsonRequest = result.children.find(
      (r: TrufosRequest) => r.title === 'json-body'
    ) as TrufosRequest;
    expect(jsonRequest.body.mimeType).toBe('application/json');
    if (jsonRequest.body.type === 'text') {
      expect(jsonRequest.body.text).toContain('"key": "value"');
    }

    const textRequest = result.children.find(
      (r: TrufosRequest) => r.title === 'text-body'
    ) as TrufosRequest;
    expect(textRequest.body.mimeType).toBe('text/plain');
    if (textRequest.body.type === 'text') {
      expect(textRequest.body.text).toContain('This is plain text content');
    }

    const xmlRequest = result.children.find(
      (r: TrufosRequest) => r.title === 'xml-body'
    ) as TrufosRequest;
    expect(xmlRequest.body.mimeType).toBe('application/xml');
    if (xmlRequest.body.type === 'text') {
      expect(xmlRequest.body.text).toContain('<root>');
    }
  });
});
