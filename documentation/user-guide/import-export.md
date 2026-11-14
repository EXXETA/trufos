---
title: Import and Export
parent: User Guide
nav_order: 8
description: Import collections from Postman, Bruno and OpenAPI documents, and export a Trufos collection as a ZIP archive.
---

# Import and Export
{: .no_toc }

Trufos imports collections from Postman and Bruno and creates collections from OpenAPI documents. To pass a Trufos collection on or back it up, export it as a ZIP archive, or [share it through Git]({% link documentation/user-guide/collections.md %}#what-trufos-writes-to-disk).

1. TOC
{:toc}

## Import a collection

1. Open the collection dropdown at the top of the sidebar and choose **Import Collection**.
2. Select the tab of the tool the collection comes from: **Postman**, **Bruno** or **OpenAPI**. (The **Trufos** tab opens a collection that is already on your disk, see [Collections and Requests]({% link documentation/user-guide/collections.md %}#create-open-and-close-collections).)
3. Pick the file or folder to import.
4. Pick the folder to save the new collection in and enter the name of the collection.
5. Click **Complete Import**.

If the folder you picked is empty, Trufos writes the collection into it. Otherwise it creates a subfolder named after the collection, so nothing is overwritten. Then the new collection opens. The original file is not changed.

{% include screenshot.html name="user-guide/import-dialog" alt="The Import Collection dialog with the Postman tab selected, a picked collection file, the target folder and the name of the new collection" width=1600 height=1050 %}

If some items could not be imported, Trufos shows a message that lists them. Everything else is imported.

Postman, Bruno and OpenAPI support come as built-in [plugins](https://github.com/EXXETA/trufos/tree/main/plugins). Plugins can add further import formats; each one appears as its own tab.

### Postman

In Postman, export the collection as **Collection v2.1** and pick the `.json` file.

| Postman                      | In Trufos                                                                     |
| ---------------------------- | ----------------------------------------------------------------------------- |
| Folders and requests         | Folders and requests, in the same order                                      |
| Collection variables         | Collection variables                                                         |
| Raw bodies (JSON, text, XML) | Text bodies with the content type from the request's `Content-Type` header   |
| File bodies                  | File bodies                                                                  |
| Form data and URL-encoded bodies | Not imported; the request has no body                                    |
| Basic, Digest, Bearer Token  | The same authorization type                                                  |
| OAuth 2.0                    | OAuth 2.0 with the client credentials, authorization code or PKCE grant      |
| Other authorization types    | Not imported; the request has no authorization                              |

Postman environments are exported as separate files and are not imported. Create the [environments]({% link documentation/user-guide/variables.md %}#environments) in Trufos instead.

### Bruno

Pick the folder of the Bruno collection, the one that contains `bruno.json`.

| Bruno                                   | In Trufos                                                       |
| --------------------------------------- | --------------------------------------------------------------- |
| Folders and HTTP requests               | Folders and requests, in Bruno's order                         |
| Environments in `environments/`         | Environments with their enabled variables                      |
| JSON, text and XML bodies               | Text bodies                                                     |
| Multipart form bodies                   | Form data bodies, including file fields                        |
| Form URL-encoded bodies                 | Text bodies with the enabled fields, URL-encoded               |
| Basic, Digest, Bearer Token             | The same authorization type                                     |
| OAuth 2.0                               | OAuth 2.0 with the client credentials or authorization code grant, with PKCE if it is enabled |
| gRPC and WebSocket requests             | Skipped and listed in the message                              |

### OpenAPI

Pick an OpenAPI 3 or Swagger 2.0 document as a `.json`, `.yaml` or `.yml` file. Trufos creates a request for each operation in the document:

- **Folders**: operations are grouped in a folder per tag (the first tag of each operation). Operations without a tag go to the top level.
- **Server**: requests are sent to `{% raw %}{{baseUrl}}{% endraw %}`, a collection variable set to the first server of the document. If the document lists several servers, Trufos also creates an environment for each one, so you can switch servers by switching the environment.
- **Bodies**: request bodies use the example from the document. If there is none, Trufos generates one from the schema.
- **Path parameters** such as `{id}` stay in the URL as they are. Replace them with values or variables.
- **Security**: Basic, Bearer, Digest and OAuth 2.0 schemes become the matching [authorization]({% link documentation/user-guide/authorization.md %}), with empty credentials for you to fill in. Security that applies to the whole document is set on the collection and inherited by the requests; operations with their own security get it on the request. API keys in headers or query parameters become a header or query parameter with an empty value. API keys in cookies are not supported.

## Export a collection

1. Open **Collection settings** (the gear above the request list) and select the **Export** tab.
2. Choose whether to **Include secrets**, and optionally set a **Password**.
3. Click **Export as ZIP…** and choose where to save the archive.

{% include screenshot.html name="user-guide/export-tab" alt="The Export tab of the collection settings with the Include secrets option, the password field and the Export as ZIP button" width=1600 height=1050 %}

The archive contains the saved state of the collection: its requests, folders, variables and environments. It does not contain unsaved drafts, the request history or files listed in the collection's `.gitignore`. Save your changes before you export.

Secret variables and credentials are left out unless you tick **Include secrets**. Then they are written into the archive unencrypted, so anyone with the archive can read them. Set a password to encrypt the archive with AES-256; you need a tool that supports AES-encrypted ZIP files to extract it, for example [7-Zip](https://www.7-zip.org/).

To open an exported collection, extract the archive into a folder and open that folder with **Import Collection** › **Trufos**.
