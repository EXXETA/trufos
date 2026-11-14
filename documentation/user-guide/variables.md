---
title: Variables
parent: User Guide
nav_order: 4
description: Reuse values across requests with collection, environment and system variables, keep secrets out of Git, and switch between environments.
---

# Variables
{: .no_toc }

Variables keep values you need in many requests in one place: a base URL, a user ID, an API key. Write {% raw %}`{{name}}`{% endraw %} wherever the value should go, and Trufos puts in the current value when it sends the request. Switch the environment, and the same requests go to another server.

1. TOC
{:toc}

## Kinds of variables

| Kind                                            | Defined in                                    | Example                     |
| ----------------------------------------------- | --------------------------------------------- | --------------------------- |
| [Collection variables](#collection-variables)   | **Collection settings** › **Variables**       | {% raw %}`{{baseUrl}}`{% endraw %}      |
| [Environment variables](#environments)          | **Collection settings** › **Environments**    | {% raw %}`{{baseUrl}}`{% endraw %} on staging |
| [System variables](#system-variables)           | Built into Trufos                             | {% raw %}`{{$randomUuid}}`{% endraw %}  |

If a collection variable and a variable of the selected environment have the same name, the environment variable wins. So you can set a default in the collection and override it in an environment. System variables start with `$`, so they never clash with your own.

[Scripts]({% link documentation/user-guide/scripting.md %}) can read and change collection and environment variables, for example to keep a token that one request fetched for the next ones.

## Use variables in a request

Variables work in:

- the URL, including the query parameters,
- header values, including the headers a request inherits from its folders and the collection,
- text bodies and the text fields of form data bodies,
- all fields of an [authorization]({% link documentation/user-guide/authorization.md %}).

Type {% raw %}`{{`{% endraw %} in the URL or in a text body, and Trufos lists the variables you can use. Pick one with the arrow keys and <kbd>Enter</kbd>.

{% include screenshot.html name="user-guide/variables-autocomplete" alt="Typing two opening braces in the URL opens a list of the system variables and the variables of the collection" width=1600 height=1050 %}

Variables are highlighted. Hover over one to see its description and the value it has right now, with the selected environment:

{% include screenshot.html name="user-guide/variables-hover" alt="Hovering over the baseUrl variable in the URL shows its current value, the staging server of the selected environment" width=1600 height=1050 %}

If the URL uses a variable that does not exist, Trufos does not send the request and tells you which variable is missing. In headers, bodies and authorization fields, an unknown variable is sent as it is, braces included.

Variables are not replaced in file bodies, in the files of form data fields, or in scripts.

## Collection variables

Open **Collection settings** (the gear above the request list) and select the **Variables** tab. Click **Add Variable** and fill in the row:

- **Key**: the name you use between the braces. It starts with a letter or `_` and can contain letters, digits and `_`, with single `-` between them, for example `api-key` or `user_id`. Names are case-sensitive. An invalid or duplicate key turns red, and you cannot save until you fix it.
- **Value**: the value Trufos puts in.
- **Description**: optional; shown when you hover over the variable.
- **Secret**: see [Secret variables](#secret-variables).

Click **Save** to keep your changes, or **Cancel** to throw them away.

{% include screenshot.html name="user-guide/variables-collection-tab" alt="The Variables tab of the collection settings with five variables; the value of the secret apiKey variable is hidden" width=1600 height=1050 %}

## Environments

An environment is a named set of variables, for example one each for your local server, staging and production. One environment of a collection can be selected at a time; its variables then override the collection variables with the same name.

Open **Collection settings** › **Environments**:

- To add an environment, type its name in the field above the list and press <kbd>Enter</kbd> or click **+**.
- Click an environment to select it and edit its variables on the right, in the same way as collection variables.
- The **⋮** menu of an environment has **Edit** (rename), **Copy** and **Delete**.

{% include screenshot.html name="user-guide/variables-environments-tab" alt="The Environments tab with the environments Production and Staging; Staging is selected and has the variables baseUrl and userId" width=1600 height=1050 %}

The environment you click in the list is the selected one once you click **Save**. To switch faster, open the [command palette]({% link documentation/user-guide/keyboard-shortcuts.md %}#command-palette) with <kbd>Ctrl</kbd>+<kbd>K</kbd> (<kbd>Cmd</kbd>+<kbd>K</kbd> on macOS), select its **Environments** tab and pick one. The [Collection Runner]({% link documentation/user-guide/history-and-runner.md %}#collection-runner) has its own environment selector.

Collections imported from OpenAPI get an environment per server, and Bruno environments are imported as well, see [Import and Export]({% link documentation/user-guide/import-export.md %}).

## Secret variables

Tick **Secret** for passwords, API keys and tokens. Trufos then:

- hides the value in the variable table (click **Show** to see it),
- saves the value encrypted in a `.secrets.bin` file instead of `collection.json`, so it never ends up in Git,
- leaves it out of [exported]({% link documentation/user-guide/import-export.md %}#export-a-collection) archives unless you choose **Include secrets**.

Because the value is encrypted for your user account, team members who clone the collection see the variable without a value and enter their own. See [What Trufos writes to disk]({% link documentation/user-guide/collections.md %}#what-trufos-writes-to-disk).

The value of a secret variable is still sent with the request, shown when you hover over the variable, and recorded in the [request history]({% link documentation/user-guide/history-and-runner.md %}#request-history), so take care when you share your screen.

## System variables

Trufos provides these variables in every collection. Most of them have a new value each time they are used.

| Variable         | Example value                               | Description                                                                 |
| ---------------- | ------------------------------------------- | --------------------------------------------------------------------------- |
| `$timestampIso`  | `2026-11-14T14:48:00.000Z`                  | The current time in [ISO 8601](https://en.wikipedia.org/wiki/ISO_8601) format, in UTC |
| `$timestampUnix` | `1794667680`                                | The current time as Unix timestamp, in seconds                             |
| `$time`          | `15:48:00 GMT+0100 (Central European Standard Time)` | The current time in the time zone of your computer                |
| `$date`          | `Sat Nov 14 2026`                           | The current date                                                            |
| `$randomInt`     | `183746592018273`                           | A random integer from 0 to 2<sup>48</sup> − 2                               |
| `$randomUuid`    | `0b32574b-38a9-4d09-843f-2a2b42bf428d`      | A random UUID (version 4)                                                    |
