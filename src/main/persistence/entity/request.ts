import {
  DirectoryWithInfo,
  DirectoryWithInfoObject,
  DirectoryWithInfoType
} from 'main/persistence/entity/directory-with-info';
import { HttpHeaders, RequestBody, RequestMethod, TextBody } from 'shim/http';

export type RequestObject = DirectoryWithInfoObject & {
  type: DirectoryWithInfoType.REQUEST;
  url: string;
  method: RequestMethod;
  headers: HttpHeaders;
  bodyInfo: RequestBody;
}

/**
 * A request which can be sent to an HTTP server. This request represents both, a request to be sent
 * using the HttpService, and a request that can be saved to a collection.
 */
export class Request extends DirectoryWithInfo {

  /** The file name of the body if the request body is of type {@link TextBody} */
  public static readonly TEXT_BODY_FILE_NAME = 'request-body.txt';

  public url: string;
  public method: RequestMethod;
  public headers: HttpHeaders;
  public body: RequestBody;

  constructor(obj: RequestObject, dirName: string, parent: DirectoryWithInfo) {
    super(obj, dirName, parent);
    this.url = obj.url;
    this.method = obj.method;
    this.headers = obj.headers;
    this.body = obj.bodyInfo;
  }

  public toObject(): RequestObject {
    return Object.assign(super.toObject(), {
      type: DirectoryWithInfoType.REQUEST as DirectoryWithInfoType.REQUEST,
      url: this.url,
      method: this.method,
      headers: this.headers,
      bodyInfo: this.body
    });
  }

  public get children() {
    return [] as [];
  }
}
