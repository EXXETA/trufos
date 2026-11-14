---
title: First Steps
parent: User Guide
nav_order: 1
description: Install Trufos on Windows, macOS or Linux, send your first request, and find where Trufos keeps your data and logs.
---

# First Steps
{: .no_toc }

This page shows you how to install Trufos, send a first request and find where your data is stored.

1. TOC
{:toc}

## Install Trufos

Download the installer for your system from the [Download]({% link download.md %}) page or from the [GitHub releases](https://github.com/EXXETA/trufos/releases). Trufos does not need an account and works fully offline.

### Windows

Run `Setup.exe`. Trufos installs for the current user and starts right away; no administrator rights are needed. Trufos checks for updates every hour while it runs and asks you to restart when an update has been downloaded.

### macOS

Open the `.dmg` file and drag Trufos into the Applications folder. There are builds for Apple silicon (`arm64`) and Intel (`x64`) Macs.

Trufos does not update itself on macOS. To update, download the new release and drag it into the Applications folder again.

### Linux

On Debian, Ubuntu and other distributions that use `.deb` packages, install the package with:

```bash
sudo apt install ./trufos_*_amd64.deb
```

On other distributions, extract the `.zip` archive anywhere and start the `trufos` executable inside it.

Trufos does not update itself on Linux. To update, download and install the new release the same way.

## Send your first request

On the first start, Trufos opens the **Default Collection**. It has an example request and an example folder, so you can try Trufos straight away.

{% include screenshot.html name="user-guide/first-steps-default-collection" alt="Trufos after the first start: the example request of the Default Collection has been sent, and the response headers are shown on the right" width=1600 height=1050 %}

1. Click **Example Request** in the sidebar. It is a `GET` request to `https://echo.free.beeceptor.com`, an echo service that answers with what it received.
2. Click **Send**, or press <kbd>Ctrl</kbd>+<kbd>Enter</kbd> (<kbd>Cmd</kbd>+<kbd>Enter</kbd> on macOS).
3. The response appears on the right: the status code, the time and the size at the top, the body and the headers below. See [Requests and Responses]({% link documentation/user-guide/requests.md %}) for everything you can set and see.

To create your own request, click the **Add new request** icon above the request list or press <kbd>Ctrl</kbd>+<kbd>N</kbd> (<kbd>Cmd</kbd>+<kbd>N</kbd>), type a name and press <kbd>Enter</kbd>. Choose the HTTP method, enter the URL and send it.

When you change a request, Trufos keeps the change as a draft until you save it with the **Save** icon or <kbd>Ctrl</kbd>+<kbd>S</kbd> (<kbd>Cmd</kbd>+<kbd>S</kbd>). Drafts survive a restart. [Collections and Requests]({% link documentation/user-guide/collections.md %}) explains this and everything else you can do with requests.

## Where Trufos stores your data

Trufos saves every collection as plain files in a folder of your choice. The Default Collection, the app settings and the list of open collections are kept in the Trufos data folder:

| System  | Data folder                            | Default Collection                                         |
| ------- | -------------------------------------- | ---------------------------------------------------------- |
| Windows | `%APPDATA%\Trufos`                     | `%APPDATA%\Trufos\default-collection`                      |
| macOS   | `~/Library/Application Support/Trufos` | `~/Library/Application Support/Trufos/default-collection`  |
| Linux   | `~/.config/Trufos`                     | `~/.config/Trufos/default-collection`                      |

On Linux, `~/.config` is replaced by `$XDG_CONFIG_HOME` if you have set it.

To keep your requests somewhere else, for example in a Git repository, [create a new collection]({% link documentation/user-guide/collections.md %}#create-open-and-close-collections) in that folder.

## Where to find the logs

If something goes wrong, the log files help to find out why. Open them with **Help** › **Open Logs Folder** in the menu bar, or go to:

| System  | Log folder               |
| ------- | ------------------------ |
| Windows | `%APPDATA%\Trufos\logs`  |
| macOS   | `~/Library/Logs/Trufos`  |
| Linux   | `~/.config/Trufos/logs`  |

The current log is `trufos.log`. Trufos does not write log entries that contain secrets, but look through the log before you share it. Attach it when you [report an issue](https://github.com/EXXETA/trufos/issues) (**Help** › **Report an Issue**).

## Next steps

- [Collections and Requests]({% link documentation/user-guide/collections.md %}): organise requests in collections and folders.
- [Requests and Responses]({% link documentation/user-guide/requests.md %}): headers, bodies and everything about the response.
- [Variables]({% link documentation/user-guide/variables.md %}): reuse values across requests and switch between environments.
- [Scripting]({% link documentation/user-guide/scripting.md %}): set variables with JavaScript before and after a request.
- [Authorization]({% link documentation/user-guide/authorization.md %}): authenticate requests, from Basic Auth to OAuth 2.0 and client certificates.
- [Import and Export]({% link documentation/user-guide/import-export.md %}): bring in collections from Postman, Bruno or OpenAPI.
