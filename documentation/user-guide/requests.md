---
title: Requests and Responses
parent: User Guide
nav_order: 3
description: Build a request with its method, URL, query parameters, headers and body, send or cancel it, and read, preview and save the response.
---

# Requests and Responses
{: .no_toc }

This page explains how to build and send a request and how to read its response. To create, organise and save requests, see [Collections and Requests]({% link documentation/user-guide/collections.md %}).

1. TOC
{:toc}

## Method and URL

Choose the HTTP method in the dropdown left of the URL field and enter the URL. The URL field highlights [variables]({% link documentation/user-guide/variables.md %}) and lists them when you type {% raw %}`{{`{% endraw %}.

Below the URL, the request has five tabs:

| Tab            | Shortcut                                              | Contains |
| -------------- | ----------------------------------------------------- | -------- |
| **Body**       | <kbd>Ctrl</kbd>+<kbd>1</kbd> (<kbd>Cmd</kbd>+<kbd>1</kbd> on macOS) | The [body](#body) |
| **Parameters** | <kbd>Ctrl</kbd>+<kbd>2</kbd>                          | The [query parameters](#query-parameters) |
| **Headers**    | <kbd>Ctrl</kbd>+<kbd>3</kbd>                          | The [headers](#headers) |
| **Auth**       | <kbd>Ctrl</kbd>+<kbd>4</kbd>                          | The [authorization]({% link documentation/user-guide/authorization.md %}) |
| **Scripts**    | <kbd>Ctrl</kbd>+<kbd>5</kbd>                          | The [pre-request and post-response scripts]({% link documentation/user-guide/scripting.md %}) |

The tab titles show how many parameters and headers are sent.

## Query parameters

The **Parameters** tab lists the query parameters of the URL, the part after `?`. Edit them in the URL or in the table; the other one follows. **Add Query Param** adds a row, **Delete All** removes all of them. Untick a parameter to leave it out of the request without deleting it.

## Headers

The **Headers** tab shows every header the request sends, in three groups:

{% include screenshot.html name="user-guide/requests-headers-tab" alt="The Headers tab of a POST request with the automatic headers Content-Type, Authorization and User-Agent and an own Accept header" width=1600 height=1050 %}

- **Automatic headers** that Trufos sets itself. Below each name, Trufos says where the value comes from:

  | Header           | Set when                                         | Can be unticked |
  | ---------------- | ------------------------------------------------ | :-------------: |
  | `Content-Type`   | The request has a body, from its type            | ✓               |
  | `Content-Length` | The body is a file                               |                 |
  | `Authorization`  | An [authorization]({% link documentation/user-guide/authorization.md %}) applies to the request; choose **None** in the Auth tab to remove it |  |
  | `User-Agent`     | Always, `Trufos/<version> (<system>)`            | ✓               |

  Values that are only known when the request is sent are shown in italics.

- **Inherited headers** from the collection and the folders above the request, with the folder they come from. Set them in **Collection settings** › **Headers** and in **Folder Settings** › **Headers** of a folder, the same way as the request's own headers. Use them for headers that many requests need, such as an API key or an `Accept` header.
- **Own headers** of the request. **Add Header** adds a row. Untick a header to keep it without sending it. **Select All** ticks or unticks all own headers, and **Delete Selected** removes the ticked ones, so untick the headers you want to keep first. The trash icon of a row removes only that header.

A header of a closer level replaces all headers with the same name from the levels before it: an inherited header replaces an automatic one, an own header replaces both, and a folder's header replaces the collection's. A replaced header is shown struck through. Untick an inherited or automatic header to not send it at all.

A header name that contains invalid characters is marked red, and a header without a name is not sent. Header values can contain variables; the variables in automatic headers are not replaced.

## Body

Choose the type of the body in the **Body** tab:

| Type          | Use it for | Content-Type |
| ------------- | ---------- | ------------ |
| **None**      | Requests without a body, such as most `GET` requests | none |
| **Text**      | JSON, XML or any other text. Choose **JSON**, **XML** or **Plain** for syntax highlighting; **Format** indents JSON and XML | `application/json`, `application/xml` or `text/plain` |
| **File**      | Sending a file as it is, for example an image or a large JSON document. Trufos streams it from the disk | The type of the file, or `application/octet-stream` |
| **Form Data** | `multipart/form-data` forms with text and file fields. Add a row per field; the button in a row switches between text and file | `multipart/form-data` with its boundary |

To send another content type, for example `application/x-www-form-urlencoded`, add your own `Content-Type` header; it replaces the automatic one.

Variables are replaced in text bodies and in the text fields of form data, not in files. A text body without any text is not sent.

## Send and cancel

Click **Send** or press <kbd>Ctrl</kbd>+<kbd>Enter</kbd> (<kbd>Cmd</kbd>+<kbd>Enter</kbd> on macOS). Trufos sends the request as you see it, including unsaved changes. While the request runs, the button turns into **Cancel**; click it to stop the request.

If the request cannot be sent, Trufos shows a message that says why, for example **Host Not Found**, **Connection Refused**, **Request Timed Out**, **Certificate Error** or an undefined variable in the URL. For certificate errors, see [Server certificates]({% link documentation/user-guide/authorization.md %}#server-certificates).

Every request you send, also a failed or cancelled one, is recorded in the [request history]({% link documentation/user-guide/history-and-runner.md %}#request-history).

## Response

The response appears on the right. At the top are the status code, the time the request took and the size of the response.

- **Response Body** (<kbd>Ctrl</kbd>+<kbd>6</kbd>) shows the body. **Pretty** formats JSON and XML and shows images; **Raw** shows the body as it was received.
- **Headers** (<kbd>Ctrl</kbd>+<kbd>7</kbd>) lists the response headers.

Click the download icon above the body to save it as a file, for example a PDF or an image the server returned.

Bodies larger than 5 MB are cut off at first, so the window stays responsive. Click **Load more** below the body to see all of it. Trufos keeps response bodies in encrypted temporary files, not in memory, and deletes them when it quits.

Each request keeps its last response while Trufos runs, so you can switch between requests and back. Older responses are in the [request history]({% link documentation/user-guide/history-and-runner.md %}#request-history).
