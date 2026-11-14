---
title: Settings, Plugins and MCP Server
parent: User Guide
nav_order: 9
description: Choose the theme, turn off TLS verification, manage the bundled plugins, and let AI agents work with your collection through the built-in MCP server.
---

# Settings, Plugins and MCP Server
{: .no_toc }

Open the settings with **Settings** at the bottom left of the sidebar, with **Trufos** › **Settings…** (macOS) or **File** › **Settings…** in the menu bar, or with <kbd>Ctrl</kbd>+<kbd>,</kbd> (<kbd>Cmd</kbd>+<kbd>,</kbd> on macOS). They apply to all collections. The settings of a single collection, such as its variables and authorization, are in **Collection settings** (the gear above the request list, or <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>,</kbd>).

1. TOC
{:toc}

## General

- **Appearance**: **Light**, **Dark**, or **System** to follow your operating system.
- **Network**: **Verify TLS certificates**. Turn it off only to reach a server with a self-signed certificate, see [Server certificates]({% link documentation/user-guide/authorization.md %}#server-certificates).
- **Logs**: opens the folder with the log files, see [Where to find the logs]({% link documentation/user-guide/first-steps.md %}#where-to-find-the-logs).

## Plugins

The importers for Postman, Bruno and OpenAPI are plugins that come with Trufos. The **Plugins** tab lists them with their version, a description and the permissions they need, for example to read the open collection or to access files. Permissions that reach outside Trufos, such as connecting to a server or running a program, are highlighted.

Use the switch of a plugin to turn it off; its import tab then disappears. If a plugin cannot be loaded, its entry says why.

## MCP server

Trufos has a built-in [MCP](https://modelcontextprotocol.io) server. With it, AI agents such as Claude Code can find, read, edit and send the requests of the open collection, with its environments, variables and authorization. Everything they do shows up in the app: requests they send appear in the [history]({% link documentation/user-guide/history-and-runner.md %}#request-history) and in the response panel, and their changes to requests are drafts that you can review and discard.

The server is off by default. To turn it on, open the **MCP Server** tab and tick **Enable MCP server**. The status next to it should say **Running**.

{% include screenshot.html name="user-guide/settings-mcp" alt="The MCP Server tab of the settings with the server running on port 7357, the URL, the hidden access token and the command to add it to Claude Code" width=1600 height=1050 %}

- **Port**: the server listens on `http://127.0.0.1:7357/mcp` by default. It only accepts connections from your own computer. If another program uses the port, the status shows an error; choose another one.
- **Access token**: clients have to send it as `Authorization: Bearer <token>`. Copy it with **Copy**. **Regenerate** creates a new token; clients that use the old one have to be set up again.
- **Add to Claude Code**: a command that adds the server to Claude Code. Copy it and run it in a terminal. For other clients, enter the URL and the token in their MCP settings.

### Permissions

The permissions decide what clients can do:

| Permission      | Default | Allows |
| --------------- | :-----: | ------ |
| **Read**        | on      | Find and read requests, environments, the history and responses, and show a request in the app |
| **Execute**     | off     | Send requests with the variables and authorization of the collection |
| **Edit**        | off     | Create, change, move and delete requests and folders, their bodies and scripts, and select the environment |
| **Write files** | off     | Save response bodies as new files anywhere on your computer; existing files are never overwritten |

Clients do not see the values of secret variables and stored credentials: Trufos replaces them with `***`. This keeps secrets out of the agent's context, but it does not protect them from an agent that tries to get them. With **Execute** and **Edit**, an agent can write a request that sends a secret to a server that echoes it back. Only give these permissions to agents you trust with the secrets of your collection.
