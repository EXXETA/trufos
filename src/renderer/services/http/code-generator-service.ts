import { TrufosRequest, RequestBodyType } from 'shim/objects/request';
import { VariableObject } from 'shim/objects/variables';
import { buildUrl } from 'shim/objects/url';

/**
 * Resolves template variables like {{baseUrl}} in a string against a key-value record.
 */
export function resolveTemplateVariables(text: string, variables: Record<string, string>): string {
  return text.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, key) => {
    return variables[key.trim()] ?? `{{${key}}}`;
  });
}

/**
 * Generates authorization header for a request based on its auth settings and variables.
 */
export function getAuthHeader(
  auth: any,
  collectionAuth?: any,
  variables: Record<string, string> = {}
): { key: string; value: string } | null {
  const resolve = (str: string) => resolveTemplateVariables(str, variables);

  if (!auth) return null;

  let targetAuth = auth;
  if (auth.type === 'inherit' && collectionAuth) {
    targetAuth = collectionAuth;
  }

  if (targetAuth.type === 'basic') {
    const user = resolve(targetAuth.username || '');
    const pass = resolve(targetAuth.password || '');
    try {
      const credentials = btoa(`${user}:${pass}`);
      return { key: 'Authorization', value: `Basic ${credentials}` };
    } catch {
      return { key: 'Authorization', value: `Basic [Invalid Credentials]` };
    }
  }

  if (targetAuth.type === 'bearer') {
    const token = resolve(targetAuth.token || '');
    return { key: 'Authorization', value: `Bearer ${token}` };
  }

  if (targetAuth.type === 'oauth2') {
    const token = resolve(targetAuth.tokens?.access_token || '');
    if (token) {
      return { key: 'Authorization', value: `Bearer ${token}` };
    }
  }

  return null;
}

/**
 * Build consolidated headers record containing active custom headers, computed content-type,
 * and auth headers with resolved variables.
 */
export function buildHeaders(
  request: TrufosRequest,
  collectionAuth: any,
  variables: Record<string, string>
): Record<string, string> {
  const headers: Record<string, string> = {};

  // 1. Add active custom headers
  for (const h of request.headers) {
    if (h.isActive && h.key) {
      headers[resolveTemplateVariables(h.key, variables)] = resolveTemplateVariables(
        h.value || '',
        variables
      );
    }
  }

  // 2. Add auth header
  const authHeader = getAuthHeader(request.auth, collectionAuth, variables);
  if (authHeader) {
    headers[authHeader.key] = authHeader.value;
  }

  // 3. Add default Content-Type header if body is present and no custom Content-Type exists
  const hasContentType = Object.keys(headers).some((k) => k.toLowerCase() === 'content-type');
  if (!hasContentType) {
    if (request.body.type === RequestBodyType.TEXT) {
      headers['Content-Type'] = request.body.mimeType || 'text/plain';
    } else if (request.body.type === RequestBodyType.FILE) {
      headers['Content-Type'] = request.body.mimeType || 'application/octet-stream';
    }
  }

  return headers;
}

/**
 * Generate cURL snippet
 */
export function generateCurl(
  request: TrufosRequest,
  resolvedUrl: string,
  headers: Record<string, string>,
  variables: Record<string, string>
): string {
  let command = `curl -X ${request.method} "${resolvedUrl}"`;

  for (const [key, value] of Object.entries(headers)) {
    const escapedValue = value.replace(/"/g, '\\"');
    command += ` \\\n  -H "${key}: ${escapedValue}"`;
  }

  if (request.body.type === RequestBodyType.TEXT && request.body.text) {
    const resolvedBody = resolveTemplateVariables(request.body.text, variables);
    const escapedBody = resolvedBody.replace(/'/g, "'\\''");
    command += ` \\\n  --data '${escapedBody}'`;
  } else if (request.body.type === RequestBodyType.FORM_DATA) {
    for (const field of request.body.fields) {
      if (!field.isActive) continue;
      if (field.value.type === RequestBodyType.TEXT) {
        const val = resolveTemplateVariables(field.value.text || '', variables);
        command += ` \\\n  -F "${field.key}=${val}"`;
      } else if (field.value.type === RequestBodyType.FILE) {
        command += ` \\\n  -F "${field.key}=@${field.value.filePath || 'file'}"`;
      }
    }
  }

  return command;
}

/**
 * Generate JS/TS Fetch snippet
 */
export function generateFetch(
  request: TrufosRequest,
  resolvedUrl: string,
  headers: Record<string, string>,
  variables: Record<string, string>,
  isTypeScript = false
): string {
  if (request.body.type === RequestBodyType.FORM_DATA) {
    const headersCopy = { ...headers };
    Object.keys(headersCopy).forEach((k) => {
      if (k.toLowerCase() === 'content-type') {
        delete headersCopy[k];
      }
    });

    let code = `const formData = new FormData();\n`;
    for (const field of request.body.fields) {
      if (!field.isActive) continue;
      if (field.value.type === RequestBodyType.TEXT) {
        const val = resolveTemplateVariables(field.value.text || '', variables);
        code += `formData.append('${field.key}', '${val.replace(/'/g, "\\'")}');\n`;
      } else if (field.value.type === RequestBodyType.FILE) {
        code += `// formData.append('${field.key}', fileInput.files[0]);\n`;
      }
    }
    code += `\nfetch('${resolvedUrl}', {\n  method: '${request.method}',\n  headers: ${JSON.stringify(headersCopy, null, 2).replace(/\n/g, '\n  ')},\n  body: formData\n})\n  .then(response => response.json())\n  .then(data => console.log(data))\n  .catch(error => console.error(error));`;
    return code;
  }

  let bodyString = '';
  if (request.body.type === RequestBodyType.TEXT && request.body.text) {
    const resolvedBody = resolveTemplateVariables(request.body.text, variables);
    const contentType = Object.keys(headers).find((k) => k.toLowerCase() === 'content-type');
    const isJson = contentType && headers[contentType].includes('application/json');
    if (isJson) {
      try {
        const parsed = JSON.parse(resolvedBody);
        bodyString = `JSON.stringify(${JSON.stringify(parsed, null, 2).replace(/\n/g, '\n  ')})`;
      } catch {
        bodyString = JSON.stringify(resolvedBody);
      }
    } else {
      bodyString = JSON.stringify(resolvedBody);
    }
  }

  const optionsStr = JSON.stringify(
    {
      method: request.method,
      headers: headers,
    },
    null,
    2
  );

  let finalOptions = optionsStr;
  if (bodyString) {
    finalOptions = optionsStr.replace(/\s*\}$/, `,\n  body: ${bodyString}\n}`);
  }

  return `fetch('${resolvedUrl}', ${finalOptions})\n  .then(response => response.json())\n  .then(data => console.log(data))\n  .catch(error => console.error(error));`;
}

/**
 * Generate JS Axios snippet
 */
export function generateAxios(
  request: TrufosRequest,
  resolvedUrl: string,
  headers: Record<string, string>,
  variables: Record<string, string>
): string {
  const headersCopy = { ...headers };

  if (request.body.type === RequestBodyType.FORM_DATA) {
    Object.keys(headersCopy).forEach((k) => {
      if (k.toLowerCase() === 'content-type') {
        delete headersCopy[k];
      }
    });

    let code = `const axios = require('axios');\nconst FormData = require('form-data');\n\nconst formData = new FormData();\n`;
    for (const field of request.body.fields) {
      if (!field.isActive) continue;
      if (field.value.type === RequestBodyType.TEXT) {
        const val = resolveTemplateVariables(field.value.text || '', variables);
        code += `formData.append('${field.key}', '${val.replace(/'/g, "\\'")}');\n`;
      } else if (field.value.type === RequestBodyType.FILE) {
        code += `// formData.append('${field.key}', fs.createReadStream('${field.value.filePath || ''}'));\n`;
      }
    }
    code += `\naxios.post('${resolvedUrl}', formData, {\n  headers: {\n    ...formData.getHeaders(),\n    ...${JSON.stringify(headersCopy, null, 2).replace(/\n/g, '\n    ')}\n  }\n})\n  .then(response => console.log(response.data))\n  .catch(error => console.error(error));`;
    return code;
  }

  let dataStr = '';
  if (request.body.type === RequestBodyType.TEXT && request.body.text) {
    const resolvedBody = resolveTemplateVariables(request.body.text, variables);
    const contentType = Object.keys(headers).find((k) => k.toLowerCase() === 'content-type');
    const isJson = contentType && headers[contentType].includes('application/json');
    if (isJson) {
      try {
        const parsed = JSON.parse(resolvedBody);
        dataStr = `,\n  data: ${JSON.stringify(parsed, null, 2).replace(/\n/g, '\n  ')}`;
      } catch {
        dataStr = `,\n  data: ${JSON.stringify(resolvedBody)}`;
      }
    } else {
      dataStr = `,\n  data: ${JSON.stringify(resolvedBody)}`;
    }
  }

  return `const axios = require('axios');\n\naxios({
  method: '${request.method.toLowerCase()}',
  url: '${resolvedUrl}',
  headers: ${JSON.stringify(headersCopy, null, 2).replace(/\n/g, '\n  ')}${dataStr}
})\n  .then(response => console.log(response.data))\n  .catch(error => console.error(error));`;
}

/**
 * Generate Python requests snippet
 */
export function generatePython(
  request: TrufosRequest,
  resolvedUrl: string,
  headers: Record<string, string>,
  variables: Record<string, string>
): string {
  const headersCopy = { ...headers };

  if (request.body.type === RequestBodyType.FORM_DATA) {
    Object.keys(headersCopy).forEach((k) => {
      if (k.toLowerCase() === 'content-type') {
        delete headersCopy[k];
      }
    });

    let code = `import requests\n\nurl = "${resolvedUrl}"\n\nfiles = {\n`;
    for (const field of request.body.fields) {
      if (!field.isActive) continue;
      if (field.value.type === RequestBodyType.TEXT) {
        code += `    '${field.key}': (None, '${resolveTemplateVariables(field.value.text || '', variables).replace(/'/g, "\\'")}'),\n`;
      } else if (field.value.type === RequestBodyType.FILE) {
        code += `    '${field.key}': ('${field.value.fileName || 'file'}', open('${field.value.filePath || ''}', 'rb')),\n`;
      }
    }
    code += `}\n\nheaders = ${JSON.stringify(headersCopy, null, 4).replace(/\n/g, '\n')}\n\nresponse = requests.post(url, headers=headers, files=files)\nprint(response.json())`;
    return code;
  }

  let bodyStr = '';
  let dataArg = '';
  if (request.body.type === RequestBodyType.TEXT && request.body.text) {
    const resolvedBody = resolveTemplateVariables(request.body.text, variables);
    const contentType = Object.keys(headers).find((k) => k.toLowerCase() === 'content-type');
    const isJson = contentType && headers[contentType].includes('application/json');

    if (isJson) {
      try {
        const parsed = JSON.parse(resolvedBody);
        const pythonifiedJson = JSON.stringify(parsed, null, 4)
          .replace(/: true/g, ': True')
          .replace(/: false/g, ': False')
          .replace(/: null/g, ': None');
        bodyStr = `payload = ${pythonifiedJson}\n\n`;
        dataArg = `, json=payload`;
      } catch {
        bodyStr = `payload = ${JSON.stringify(resolvedBody)}\n\n`;
        dataArg = `, data=payload`;
      }
    } else {
      bodyStr = `payload = ${JSON.stringify(resolvedBody)}\n\n`;
      dataArg = `, data=payload`;
    }
  }

  const headersStr = `headers = ${JSON.stringify(headersCopy, null, 4)}\n\n`;

  return `import requests\n\nurl = "${resolvedUrl}"\n\n${bodyStr}${headersStr}response = requests.request("${request.method}", url, headers=headers${dataArg})\n\nprint(response.text)`;
}

/**
 * Generate code snippet based on selected language
 */
export function generateCodeSnippet(
  target: string,
  request: TrufosRequest,
  collectionAuth: any,
  activeEnvironmentVariables: [string, VariableObject][]
): string {
  const variables: Record<string, string> = {};
  for (const [key, obj] of activeEnvironmentVariables) {
    variables[key] = obj.value;
  }

  const resolvedUrl = resolveTemplateVariables(buildUrl(request.url), variables);
  const headers = buildHeaders(request, collectionAuth, variables);

  switch (target) {
    case 'curl':
      return generateCurl(request, resolvedUrl, headers, variables);
    case 'fetch_js':
      return generateFetch(request, resolvedUrl, headers, variables, false);
    case 'fetch_ts':
      return generateFetch(request, resolvedUrl, headers, variables, true);
    case 'axios':
      return generateAxios(request, resolvedUrl, headers, variables);
    case 'python':
      return generatePython(request, resolvedUrl, headers, variables);
    default:
      return '';
  }
}
