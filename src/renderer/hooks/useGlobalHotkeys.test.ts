import { describe, it, expect } from 'vitest';
import { Folder } from 'shim/objects/folder';
import { TrufosRequest } from 'shim/objects/request';

const getAllRequestsInOrder = (children: (Folder | TrufosRequest)[]): string[] => {
  const result: string[] = [];
  for (const child of children) {
    if (child.type === 'request') {
      result.push(child.id);
    } else if (child.type === 'folder') {
      result.push(...getAllRequestsInOrder(child.children || []));
    }
  }
  return result;
};

describe('getAllRequestsInOrder', () => {
  it('should extract requests from flat structure', () => {
    const children: (Folder | TrufosRequest)[] = [
      { type: 'request', id: 'req1' } as TrufosRequest,
      { type: 'request', id: 'req2' } as TrufosRequest,
      { type: 'request', id: 'req3' } as TrufosRequest,
    ];

    const result = getAllRequestsInOrder(children);
    expect(result).toEqual(['req1', 'req2', 'req3']);
  });

  it('should extract requests from nested folders (one level)', () => {
    const children: (Folder | TrufosRequest)[] = [
      { type: 'request', id: 'req1' } as TrufosRequest,
      {
        type: 'folder',
        id: 'folder1',
        children: [
          { type: 'request', id: 'req2' } as TrufosRequest,
          { type: 'request', id: 'req3' } as TrufosRequest,
        ],
      } as Folder,
      { type: 'request', id: 'req4' } as TrufosRequest,
    ];

    const result = getAllRequestsInOrder(children);
    expect(result).toEqual(['req1', 'req2', 'req3', 'req4']);
  });

  it('should extract requests from deeply nested folders (multiple levels)', () => {
    const children: (Folder | TrufosRequest)[] = [
      { type: 'request', id: 'req1' } as TrufosRequest,
      {
        type: 'folder',
        id: 'folder1',
        children: [
          { type: 'request', id: 'req2' } as TrufosRequest,
          {
            type: 'folder',
            id: 'folder2',
            children: [
              { type: 'request', id: 'req3' } as TrufosRequest,
              {
                type: 'folder',
                id: 'folder3',
                children: [
                  { type: 'request', id: 'req4' } as TrufosRequest,
                  { type: 'request', id: 'req5' } as TrufosRequest,
                ],
              } as Folder,
              { type: 'request', id: 'req6' } as TrufosRequest,
            ],
          } as Folder,
          { type: 'request', id: 'req7' } as TrufosRequest,
        ],
      } as Folder,
      { type: 'request', id: 'req8' } as TrufosRequest,
    ];

    const result = getAllRequestsInOrder(children);
    expect(result).toEqual(['req1', 'req2', 'req3', 'req4', 'req5', 'req6', 'req7', 'req8']);
  });

  it('should handle empty folders', () => {
    const children: (Folder | TrufosRequest)[] = [
      { type: 'request', id: 'req1' } as TrufosRequest,
      {
        type: 'folder',
        id: 'folder1',
        children: [],
      } as Folder,
      { type: 'request', id: 'req2' } as TrufosRequest,
    ];

    const result = getAllRequestsInOrder(children);
    expect(result).toEqual(['req1', 'req2']);
  });

  it('should handle complex nested structure with multiple branches', () => {
    const children: (Folder | TrufosRequest)[] = [
      {
        type: 'folder',
        id: 'api',
        children: [
          { type: 'request', id: 'auth' } as TrufosRequest,
          {
            type: 'folder',
            id: 'users',
            children: [
              { type: 'request', id: 'getUsers' } as TrufosRequest,
              { type: 'request', id: 'createUser' } as TrufosRequest,
              {
                type: 'folder',
                id: 'userDetails',
                children: [
                  { type: 'request', id: 'getUserById' } as TrufosRequest,
                  { type: 'request', id: 'updateUser' } as TrufosRequest,
                  { type: 'request', id: 'deleteUser' } as TrufosRequest,
                ],
              } as Folder,
            ],
          } as Folder,
        ],
      } as Folder,
      {
        type: 'folder',
        id: 'products',
        children: [
          { type: 'request', id: 'getProducts' } as TrufosRequest,
          { type: 'request', id: 'createProduct' } as TrufosRequest,
        ],
      } as Folder,
    ];

    const result = getAllRequestsInOrder(children);
    expect(result).toEqual([
      'auth',
      'getUsers',
      'createUser',
      'getUserById',
      'updateUser',
      'deleteUser',
      'getProducts',
      'createProduct',
    ]);
  });
});
