---
title: Scripting
parent: User Guide
nav_order: 5
description: Run JavaScript before a request is sent and after its response arrives, read and set variables, and log to the request history.
---

# Scripting
{: .no_toc }

Every request can have two scripts: a **pre-request** script that runs before the request is sent, and a **post-response** script that runs after the response has arrived. Scripts are written in JavaScript and can read and set [variables]({% link documentation/user-guide/variables.md %}), for example to count requests, to pick values for an environment or to prepare values for the following requests.

1. TOC
{:toc}

## Write a script

1. Select the request and open its **Scripts** tab (<kbd>Ctrl</kbd>+<kbd>5</kbd>, <kbd>Cmd</kbd>+<kbd>5</kbd> on macOS).
2. Choose **Pre-Request** or **Post-Response** in the selector above the editor.
3. Write the script. The editor knows the `trufos` object and completes its functions as you type.

{% include screenshot.html name="user-guide/scripting-tab" alt="The Scripts tab of a request with a pre-request script that counts how often the request is sent and warns if no environment is selected" width=1600 height=1050 %}

Scripts belong to the request. They are saved with it as separate files next to `request.json`, so they are versioned in Git like the rest of the collection, and changes to them are a draft until you save the request. Folders and the collection have no scripts of their own.

## When scripts run

When you send a request, Trufos:

1. runs the **pre-request** script,
2. replaces the variables in the URL, the headers, the body and the authorization, with the values the pre-request script left behind,
3. sends the request and waits for the whole response,
4. runs the **post-response** script.

Because the variables are replaced after the pre-request script has run, a variable that the script sets is already used by the request it belongs to.

Scripts also run when the request is sent by the [Collection Runner]({% link documentation/user-guide/history-and-runner.md %}#collection-runner) or by an AI agent through the [MCP server]({% link documentation/user-guide/settings.md %}#mcp-server).

If a script throws an error, the error is logged to the [console](#see-the-output) and the request is sent anyway. Variables that the script set before the error are kept.

## The scripting API

Scripts have the standard JavaScript built-ins (`JSON`, `Math`, `Date`, `String`, `Number` and so on), a [`console`](#see-the-output) and a `trufos` object:

| Member | Description |
| ------ | ----------- |
| `trufos.version` | The version of Trufos, for example `"1.0.0"` |
| `trufos.getCollectionVariable(name)` | The value of a collection variable, or `undefined` if it does not exist |
| `trufos.setCollectionVariable(name, value)` | Sets a collection variable; creates it if it does not exist |
| `trufos.getEnvironmentVariable(name, environment?)` | The value of a variable of the selected environment, or of the named one. `undefined` if the variable or the environment does not exist, or if no environment is selected |
| `trufos.setEnvironmentVariable(name, value, environment?)` | Sets a variable in the selected environment, or in the named one. Does nothing if that environment does not exist |

The `value` you set is either a string or an object with these properties:

| Property | Description |
| -------- | ----------- |
| `value` | The value, a string. Required |
| `description` | Shown when you hover over the variable. Optional |
| `secret` | `true` to store the value encrypted and keep it out of Git, see [Secret variables]({% link documentation/user-guide/variables.md %}#secret-variables). Optional |

Properties you leave out keep their old values, so setting a string does not change the description or the secret flag of an existing variable.

`getEnvironmentVariable` only reads the environment; it does not fall back to the collection variable of the same name. Variables are always strings: use `Number(…)` and `String(…)` to calculate with them.

## Changed variables are saved

Trufos saves the variables a script sets right away, the same as when you change them in the collection settings. A collection variable that is not secret is written to `collection.json`, so it shows up as a change in Git. Use secret variables for values that change on every request or that should stay on your computer.

## See the output

Use `console.log`, `console.info`, `console.debug`, `console.warn` and `console.error` to print values. The output is not written to the app log, as scripts often handle secrets. You find it in the [request history]({% link documentation/user-guide/history-and-runner.md %}#request-history): open the history, select the request and open its **Console** tab. Each line starts with the script that printed it. Errors of a script, including syntax errors, appear there as well.

{% include screenshot.html name="user-guide/scripting-history-console" alt="The Console tab of a history entry with the lines logged by the pre-request and the post-response script" width=1600 height=1050 %}

## Limits

Scripts run in a sandbox. Keep in mind:

- **No access to the request or the response.** Scripts cannot read or change the URL, the headers or the body of the request, nor read the status, headers or body of the response. A post-response script cannot, for example, take a token out of the response body. Use the [authorization types]({% link documentation/user-guide/authorization.md %}) for logins; OAuth 2.0 fetches and refreshes tokens on its own.
- **Synchronous only.** There is no `fetch`, `setTimeout` or `require`, and no access to files. Code in `.then()` callbacks or after `await` runs after the script has finished; setting a variable there has no effect and logs an error.
- **Time limit.** A script that runs longer than 5 seconds is stopped.
- **No state between runs.** Each run starts fresh. Keep what you need in variables.

## Examples

Count how often a request was sent:

```js
const count = Number(trufos.getCollectionVariable('count') ?? 0) + 1;
trufos.setCollectionVariable('count', String(count));
console.log('Sending request', count);
```

Generate a value once per request and keep it secret, for example an idempotency key you send in a header as {% raw %}`{{idempotencyKey}}`{% endraw %}:

```js
const key = Date.now().toString(36) + Math.random().toString(36).slice(2);
trufos.setCollectionVariable('idempotencyKey', { value: key, secret: true });
```

Set a date range for a report, relative to today:

```js
const today = new Date();
const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
trufos.setCollectionVariable('from', lastWeek.toISOString().slice(0, 10));
trufos.setCollectionVariable('to', today.toISOString().slice(0, 10));
```

Fail loudly if a request is sent to production by accident:

```js
const baseUrl = trufos.getEnvironmentVariable('baseUrl') ?? '';
if (baseUrl.includes('api.bookshop.example')) {
  console.warn('This request goes to PRODUCTION');
}
```

Copy a value from one environment to another:

```js
const token = trufos.getEnvironmentVariable('apiKey', 'Staging');
if (token != null) trufos.setEnvironmentVariable('apiKey', token, 'Local');
```
