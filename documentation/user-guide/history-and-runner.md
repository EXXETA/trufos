---
title: History and Collection Runner
parent: User Guide
nav_order: 7
description: Look up the requests you sent with their responses and script output, and send many requests of a collection in one go.
---

# History and Collection Runner
{: .no_toc }

1. TOC
{:toc}

## Request history

Trufos records every request you send: the request exactly as it went out, with all variables replaced and the authorization added, the response, and the output of its [scripts]({% link documentation/user-guide/scripting.md %}#see-the-output). Requests sent by the [Collection Runner](#collection-runner) and by AI agents through the [MCP server]({% link documentation/user-guide/settings.md %}#mcp-server) are recorded as well.

To open the history, click the clock icon above the request list, choose **Collection** › **History** in the menu bar, or press <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>H</kbd> (<kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>H</kbd> on macOS). Click the icon again to get back to the request list.

The sidebar then lists the sent requests of the open collection, newest first, with the method, the URL, the status code and the time. Select one to see it:

{% include screenshot.html name="user-guide/scripting-history-console" alt="A history entry with the sent request on the left, its Console tab open, and the response on the right" width=1600 height=1050 %}

- On the left, the request as it was sent: **Body**, **Parameters**, **Headers** and the **Console** with the script output.
- On the right, the response with its body and headers, or the reason the request failed or was cancelled.
- The arrow icon at the top right opens the request in the editor, the cross closes the entry.

The history only lasts while Trufos runs; it is not saved and starts empty on the next start. It keeps the last 100 requests of all collections together. Click the trash icon above the list to clear it.

The history contains the real values of secret variables and credentials, as they were sent. It is kept in memory and in temporary files that are encrypted with a key that only exists while Trufos runs.

## Collection Runner

The Collection Runner sends many requests of a collection one after the other and shows whether they succeeded, for example to check an API after a deployment.

{% include screenshot.html name="user-guide/collection-runner" alt="The Collection Runner after a run: two requests of the Default Collection, both passed with status 200" width=1600 height=1050 %}

1. Open it with **Run Collection** in the collection dropdown, **Collection** › **Run Collection** in the menu bar, or <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd> (<kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd>).
2. Choose the **Environment** at the top left. This changes the selected environment of the collection.
3. Tick the requests to send. Ticking a folder ticks all requests in it; **All** and **None** tick or untick everything.
4. Tick **Stop on first failure** if the run should stop at the first request that fails.
5. Click **Run _n_ requests**. **Stop run** stops it right away and cancels the request that is running.

The requests are sent one after the other, in the order of the sidebar, with their [scripts]({% link documentation/user-guide/scripting.md %}) and including unsaved changes. A variable that a script sets is available to the requests after it.

For each request, the table shows the status code, the result and the time it took. A request **passed** if the server answered with a status code from 200 to 399, and **failed** otherwise or if it could not be sent. Click a row to see the response body and headers. Below the table, Trufos counts the passed and failed requests and shows how long the run took.

Press <kbd>Escape</kbd> or click the cross at the top to close the runner. Closing it stops a running run.
