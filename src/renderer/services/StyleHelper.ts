import { RequestMethod } from 'shim/objects/request-method';

export const httpMethodColor = (request: RequestMethod) => {
  switch (request) {
    case RequestMethod.GET:
      return 'http-method-color-get';
    case RequestMethod.POST:
      return 'http-method-color-post';
    case RequestMethod.PUT:
      return 'http-method-color-put';
    case RequestMethod.DELETE:
      return 'http-method-color-delete';
    case RequestMethod.PATCH:
      return 'http-method-color-patch';
    case RequestMethod.OPTIONS:
      return 'http-method-color-get';
    case RequestMethod.HEAD:
      return 'http-method-color-head';
    case RequestMethod.CONNECT:
      return 'http-method-color-connect';
    case RequestMethod.TRACE:
      return 'http-method-color-trace';
  }
};
