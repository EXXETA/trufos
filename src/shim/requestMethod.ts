export enum RequestMethod {
  get = 'GET',
  post = 'POST',
  put = 'PUT',
  delete = 'DELETE',
  patch = 'PATCH',
  options = 'OPTIONS',
  head = 'HEAD',
  connect = 'CONNECT',
  trace = 'TRACE'
}

// TODO IN HELPERCLASS TO FE
export const httpMethodColor = (request: RequestMethod) => {
  switch (request) {
    case RequestMethod.get:
      return 'http-method-color-get';
    case RequestMethod.post:
      return 'http-method-color-post';
    case RequestMethod.put:
      return 'http-method-color-put';
    case RequestMethod.delete:
      return 'http-method-color-delete';
    case RequestMethod.patch:
      return 'http-method-color-patch';
    case RequestMethod.options:
      return 'http-method-color-get';
    case RequestMethod.head:
      return 'http-method-color-head';
    case RequestMethod.connect:
      return 'http-method-color-connect';
    case RequestMethod.trace:
      return 'http-method-color-trace';
  }
}
