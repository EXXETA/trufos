import { Folder } from 'shim/objects/folder';
import { ImportService } from './import-service';
import fs from 'node:fs/promises';
import { PersistenceService } from 'main/persistence/service/persistence-service';
import { RufusRequest } from 'shim/objects/request';
import { tmpdir } from 'node:os';
import path from 'node:path';

const POSTMAN_COLLECTION = '{"info":{"name":"HTTP Status Messages","id":"my-collection-id","_postman_schema":"https://schema.getpostman.com/#2.0.0","version":{"major":"2","minor":"0","patch":"0","prerelease":"draft.1"}},"variable":[{"id":"var-1","type":"string","value":"hello-world"},{"id":"var-2","type":"number","value":"123"},{"id":"var-3","type":"boolean","value":"true"},{"id":"var-4","type":"any","value":"hello-world-any"},{"id":"var-5","value":null}],"event":[{"listen":"test","id":"my-global-script-1","script":{"type":"text/javascript","exec":["const package1 = pm.require(\\"package1\\");","console.log(\\"hello\\", package1);"],"packages":{"package1":{"id":"script-package-1"}}}},{"listen":"prerequest","script":{"type":"text/javascript","exec":["const package1 = pm.require(\\"package1\\");","console.log(\\"hello\\", package1);"],"packages":{"package1":{"id":"script-package-1"}}}}],"item":[{"id":"request-200","description":{"content":"<h1>This is H1</h1> <i>italic</i> <script>this will be dropped in toString()</script>","version":"2.0.1-abc+efg"},"name":"200 ok","request":"http://echo.getpostman.com/status/200","response":[{"name":"a sample response","originalRequest":"http://echo.getpostman.com/status/200","status":"200 OK","code":200,"header":"Content-Type: application/json\\r\\nAuthorization: Hawk id=\\"dh37fgj492je\\", ts=\\"1448549987\\", nonce=\\"eOJZCd\\", mac=\\"O2TFlvAlMvKVSKOzc6XkfU6+5285k5p3m5dAjxumo2k=\\"\\r\\n","cookie":[{"domain":".httpbin.org","expires":1502442248,"hostOnly":false,"httpOnly":false,"key":"_ga","path":"/","secure":false,"session":false,"_postman_storeId":"0","value":"GA1.2.113558537.1435817423"}],"body":"response body"}],"event":[{"listen":"test","script":"my-global-script-1"},{"listen":"test","script":{"type":"text/javascript","exec":"console.log(\\"hello\\");"}}],"proxy":{"match":"https://*.getpostman.com/*","server":"https://proxy.com"},"protocolProfileBehavior":{"disableBodyPruning":true}},{"id":"request-200-post","description":{"content":"<h1>This is H1</h1> <i>italic</i> <script>this will be dropped in toString()</script>","version":"2.0.1-abc+efg"},"name":"200 ok","request":{"description":{"content":"my description","type":"text/markdown"},"method":"POST","url":"http://echo.getpostman.com/post","header":[{"key":"Content-Type","value":"application/json"}],"body":{"mode":"urlencoded","urlencoded":[{"key":"yo","value":"mate"}]}},"response":[{"name":"a sample response","originalRequest":"http://echo.getpostman.com/post","status":"200 OK","code":200,"header":"Content-Type: application/json\\r\\nAuthorization: Hawk id=\\"dh37fgj492je\\", ts=\\"1448549987\\", nonce=\\"eOJZCd\\", mac=\\"O2TFlvAlMvKVSKOzc6XkfU6+5285k5p3m5dAjxumo2k=\\"\\r\\n","cookie":[{"domain":".httpbin.org","expires":1502442248,"hostOnly":false,"httpOnly":false,"key":"_ga","path":"/","secure":false,"session":false,"_postman_storeId":"0","value":"GA1.2.113558537.1435817423"}],"body":"response body"}],"event":[{"listen":"test","script":"my-global-script-1"},{"listen":"test","script":{"type":"text/javascript","exec":"console.log(\\"hello\\");"}}]},{"name":"This is a folder","id":"my-folder-1","_my_meta":"hello","item":[{"id":"request-200","name":"201","request":{"url":"http://echo.getpostman.com/status/201","method":"PUT","body":{"mode":"urlencoded","urlencoded":[{"key":"yo","value":"mate"}]},"header":"Content-Type: application/json\\nAuthorization: Hawk id=\\"dh37fgj492je\\", ts=\\"1448549987\\", nonce=\\"eOJZCd\\", mac=\\"O2TFlvAlMvKVSKOzc6XkfU6+5285k5p3m5dAjxumo2k=\\"\\n"}},{"id":"request-post","name":"201","request":{"url":"http://echo.getpostman.com/post","body":{"mode":"raw","raw":"blahblah"},"auth":{"type":"basic","basic":{"username":"yosam","password":"asdhjajsd"}}}},{"id":"request-400","name":"400 bad request","request":"http://shamasis:pass@echo.getpostman.com:9443/status/400/?query=string&a=b&abcd#{{search}}"},{"id":"This is a sub folder","name":"my-folder-2","item":[{"id":"blank-folder","name":"This is a blank","item":[{"id":"request-gg","name":"gg not found","request":{"description":{"content":"Some stuff I want to say about this request. It\'s in *markdown* too.","type":"text/markdown","version":"1.2.3+hi"},"url":{"description":"This is a nice URL.","protocol":"https","port":"8443","path":"path/to/document","host":"sub.example.com."},"header":[{"key":"Host","value":"sub.example.com"},{"key":"Content-Type","value":"application/json"}]},"event":[{"listen":"test","script":{"type":"text/javascript","exec":["postman.setEnvironmentVariable(\\"username\\", \\"a85\\");","postman.setEnvironmentVariable(\\"repository\\", \\"Newman\\")"]}},{"listen":"prerequest","script":{"type":"text/javascript","exec":"console.log(\\"hello\\");\\r\\nconsole.log(\'hi\')"}}]}]},{"id":"solo-folder","name":"Solo Folder","item":[{"id":"request-404","name":"404 not found","request":{"description":{"content":"Some stuff I want to say about this request. It\'s in *markdown* too.","type":"text/markdown","version":"1.2.3+hi"},"url":{"description":"This is a nice URL.","protocol":"https","port":"8443","path":"path/to/document","host":"sub.example.com."},"auth":{"type":"hawk","basic":{"username":"yosam","password":"asdhjajsd"},"hawk":{"authKey":"asjehcgfdjyrggucgn"}},"header":[{"key":"Access-Control-Allow-Credentials","value":"true","description":"Setting this header to \'true\' means that the server allows cookies (or other user credentials) to be included on cross-origin requests."},{"key":"Server","value":"nginx","description":"Server Name"}]},"event":[{"listen":"test","script":{"type":"text/javascript","exec":["postman.setEnvironmentVariable(\\"username\\", \\"a85\\");","postman.setEnvironmentVariable(\\"repository\\", \\"Newman\\")"]}},{"listen":"prerequest","script":{"type":"text/javascript","exec":"console.log(\\"hello\\");\\r\\nconsole.log(\'hi\')"}}]}]}]}]}],"protocolProfileBehavior":{"disableBodyPruning":false}}';
const POSTMAN_COLLECTION_FILE_PATH = path.join(tmpdir(), 'postman-collection.json');

jest.mock('main/persistence/service/persistence-service');

describe('ImportService', () => {
  it('should import a Postman collection', async () => {

    // Arrange
    const targetDirPath = tmpdir();
    const importService = ImportService.instance;
    await fs.writeFile(POSTMAN_COLLECTION_FILE_PATH, POSTMAN_COLLECTION);
    (PersistenceService.instance.saveCollectionRecursive as jest.Mock).mockImplementation(async () => null);

    // Act
    const result = await importService.importCollection(POSTMAN_COLLECTION_FILE_PATH, targetDirPath, 'Postman');

    // Assert
    expect(result.type).toBe('collection');
    expect(result.title).toBe('HTTP Status Messages');
    expect(Object.keys(result.variables).length).toBe(5);

    const childrenLevel1 = result.children;
    expect(childrenLevel1.length).toBe(3);

    const firstChild = childrenLevel1[0] as RufusRequest;
    expect(firstChild.type).toBe('request');
    expect(firstChild.title).toBe('200 ok');
    expect(firstChild.url).toBe('http://echo.getpostman.com/status/200');
    expect(firstChild.method).toBe('GET');
    expect(firstChild.headers).toEqual([]);
    expect(firstChild.body).toEqual(null);

    const secondChild = childrenLevel1[1] as RufusRequest;
    expect(secondChild.type).toBe('request');
    expect(secondChild.title).toBe('200 ok');
    expect(secondChild.url).toBe('http://echo.getpostman.com/post');
    expect(secondChild.method).toBe('POST');
    expect(secondChild.headers).toEqual([{
      'isActive': true,
      'key': 'Content-Type',
      'value': 'application/json',
    }]);
    expect(secondChild.body).toEqual(null);

    const thirdChild = childrenLevel1[2] as Folder;
    expect(thirdChild.type).toBe('folder');
    expect(thirdChild.title).toBe('This is a folder');

    const childrenLevel2 = thirdChild.children;
    expect(childrenLevel2.length).toBe(4);

    const firstChildLevel2 = childrenLevel2[0] as RufusRequest;
    expect(firstChildLevel2.type).toBe('request');
    expect(firstChildLevel2.title).toBe('201');
    expect(firstChildLevel2.url).toBe('http://echo.getpostman.com/status/201');
    expect(firstChildLevel2.method).toBe('PUT');
    expect(firstChildLevel2.headers).toEqual([{
      'isActive': true,
      'key': 'Content-Type',
      'value': 'application/json',
    }, {
      'isActive': true,
      'key': 'Authorization',
      'value': 'Hawk id="dh37fgj492je", ts="1448549987", nonce="eOJZCd", mac="O2TFlvAlMvKVSKOzc6XkfU6+5285k5p3m5dAjxumo2k="',
    }]);
    expect(firstChildLevel2.body).toEqual(null);

    const secondChildLevel2 = childrenLevel2[1] as RufusRequest;
    expect(secondChildLevel2.type).toBe('request');
    expect(secondChildLevel2.title).toBe('201');
    expect(secondChildLevel2.url).toBe('http://echo.getpostman.com/post');
    expect(secondChildLevel2.method).toBe('GET');
    expect(secondChildLevel2.headers).toEqual([]);
    expect(secondChildLevel2.body).toEqual({
      'mimeType': 'text/plain',
      'text': 'blahblah',
      'type': 'text',
    });
  });
});

