import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  AuthorizationType,
  OAuth2ClientAuthenticationMethod,
  OAuth2Method,
  OAuth2PKCECodeChallengeMethod,
} from 'shim/objects/auth';
import { TrufosRequest } from 'shim/objects/request';
import { describe, expect, it } from 'vitest';
import { PostmanImporter } from './postman-importer';

const createCollection = (auth: unknown) => ({
  info: {
    name: 'Auth Import Test',
    id: 'test-collection-id',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  item: [
    {
      id: 'test-request-id',
      name: 'test request',
      request: {
        method: 'GET',
        url: 'https://example.com/resource',
        auth,
      },
    },
  ],
});

describe('PostmanImporter', () => {
  it('imports basic auth', async () => {
    const collection = createCollection({
      type: 'basic',
      basic: [
        { key: 'username', value: 'user1' },
        { key: 'password', value: 'pass1' },
      ],
    });
    const srcFilePath = path.join(tmpdir(), 'postman-basic.json');
    await fs.writeFile(srcFilePath, JSON.stringify(collection));

    const result = await new PostmanImporter().importCollection(srcFilePath);
    const request = result.children[0] as TrufosRequest;

    expect(request.auth).toEqual({
      type: AuthorizationType.BASIC,
      username: 'user1',
      password: 'pass1',
    });
  });

  it('imports bearer auth', async () => {
    const collection = createCollection({
      type: 'bearer',
      bearer: [{ key: 'token', value: 'my-token-123' }],
    });
    const srcFilePath = path.join(tmpdir(), 'postman-bearer.json');
    await fs.writeFile(srcFilePath, JSON.stringify(collection));

    const result = await new PostmanImporter().importCollection(srcFilePath);
    const request = result.children[0] as TrufosRequest;

    expect(request.auth).toEqual({
      type: AuthorizationType.BEARER,
      token: 'my-token-123',
    });
  });

  it('imports oauth2 client credentials auth', async () => {
    const collection = createCollection({
      type: 'oauth2',
      oauth2: [
        { key: 'grant_type', value: 'client_credentials' },
        { key: 'accessTokenUrl', value: 'https://example.com/oauth/token' },
        { key: 'clientId', value: 'client-id' },
        { key: 'clientSecret', value: 'client-secret' },
        { key: 'scope', value: 'read:all' },
        { key: 'addTokenTo', value: 'header' },
      ],
    });
    const srcFilePath = path.join(tmpdir(), 'postman-oauth2-cc.json');
    await fs.writeFile(srcFilePath, JSON.stringify(collection));

    const result = await new PostmanImporter().importCollection(srcFilePath);
    const request = result.children[0] as TrufosRequest;

    expect(request.auth).toEqual({
      type: AuthorizationType.OAUTH2,
      method: OAuth2Method.CLIENT_CREDENTIALS,
      issuerUrl: '',
      tokenUrl: 'https://example.com/oauth/token',
      clientId: 'client-id',
      clientSecret: 'client-secret',
      scope: 'read:all',
      clientAuthenticationMethod: OAuth2ClientAuthenticationMethod.BASIC_AUTH,
    });
  });

  it('imports oauth2 authorization code auth', async () => {
    const collection = createCollection({
      type: 'oauth2',
      oauth2: [
        { key: 'grant_type', value: 'authorization_code' },
        { key: 'authUrl', value: 'https://example.com/oauth/authorize' },
        { key: 'accessTokenUrl', value: 'https://example.com/oauth/token' },
        { key: 'clientId', value: 'client-id-2' },
        { key: 'clientSecret', value: 'client-secret-2' },
        { key: 'scope', value: 'write:all' },
        { key: 'redirect_uri', value: 'http://localhost:3000/callback' },
        { key: 'addTokenTo', value: 'header' },
      ],
    });
    const srcFilePath = path.join(tmpdir(), 'postman-oauth2-ac.json');
    await fs.writeFile(srcFilePath, JSON.stringify(collection));

    const result = await new PostmanImporter().importCollection(srcFilePath);
    const request = result.children[0] as TrufosRequest;

    expect(request.auth).toEqual({
      type: AuthorizationType.OAUTH2,
      method: OAuth2Method.AUTHORIZATION_CODE,
      issuerUrl: '',
      tokenUrl: 'https://example.com/oauth/token',
      clientId: 'client-id-2',
      clientSecret: 'client-secret-2',
      scope: 'write:all',
      clientAuthenticationMethod: OAuth2ClientAuthenticationMethod.BASIC_AUTH,
      authorizationUrl: 'https://example.com/oauth/authorize',
      callbackUrl: 'http://localhost:3000/callback',
    });
  });

  it('imports oauth2 authorization code pkce auth', async () => {
    const collection = createCollection({
      type: 'oauth2',
      oauth2: [
        { key: 'grant_type', value: 'authorization_code_with_pkce' },
        { key: 'authUrl', value: 'https://example.com/oauth/authorize' },
        { key: 'accessTokenUrl', value: 'https://example.com/oauth/token' },
        { key: 'clientId', value: 'client-id-3' },
        { key: 'clientSecret', value: 'client-secret-3' },
        { key: 'scope', value: 'api:read' },
        { key: 'redirect_uri', value: 'http://localhost:8080/callback' },
        { key: 'client_authentication', value: 'body' },
        { key: 'challengeAlgorithm', value: 'S256' },
        { key: 'code_verifier', value: 'my-code-verifier' },
      ],
    });
    const srcFilePath = path.join(tmpdir(), 'postman-oauth2-pkce.json');
    await fs.writeFile(srcFilePath, JSON.stringify(collection));

    const result = await new PostmanImporter().importCollection(srcFilePath);
    const request = result.children[0] as TrufosRequest;

    expect(request.auth).toEqual({
      type: AuthorizationType.OAUTH2,
      method: OAuth2Method.AUTHORIZATION_CODE_PKCE,
      issuerUrl: '',
      tokenUrl: 'https://example.com/oauth/token',
      clientId: 'client-id-3',
      clientSecret: 'client-secret-3',
      scope: 'api:read',
      clientAuthenticationMethod: OAuth2ClientAuthenticationMethod.REQUEST_BODY,
      authorizationUrl: 'https://example.com/oauth/authorize',
      callbackUrl: 'http://localhost:8080/callback',
      codeChallengeMethod: OAuth2PKCECodeChallengeMethod.S256,
      codeVerifier: 'my-code-verifier',
    });
  });

  it('imports request without auth', async () => {
    const collection = createCollection(undefined);
    const srcFilePath = path.join(tmpdir(), 'postman-no-auth.json');
    await fs.writeFile(srcFilePath, JSON.stringify(collection));

    const result = await new PostmanImporter().importCollection(srcFilePath);
    const request = result.children[0] as TrufosRequest;

    expect(request.auth).toBeUndefined();
  });
});
