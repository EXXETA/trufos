---
title: Authorization
parent: User Guide
nav_order: 6
description: Authenticate requests with Basic Auth, Bearer tokens, Digest, OAuth 1.0 or OAuth 2.0, share an authorization through folders and collections, and use client certificates (mTLS).
---

# Authorization
{: .no_toc }

Trufos adds the credentials an API needs to each request. You can set an authorization on a single request, or once on a folder or the collection and let the requests inherit it.

1. TOC
{:toc}

## Where to set it

| For               | Open                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------ |
| A request         | The **Auth** tab of the request (<kbd>Ctrl</kbd>+<kbd>4</kbd>, <kbd>Cmd</kbd>+<kbd>4</kbd> on macOS) |
| A folder          | **Folder Settings** in the folder's **⋮** menu, **Authorization** tab                      |
| The collection    | **Collection settings** (the gear above the request list), **Authorization** tab           |

Choose a type under **Authorization Type** and fill in its fields. You can use [variables]({% link documentation/user-guide/variables.md %}) in all fields, for example to keep a different client ID in each environment.

{% include screenshot.html name="user-guide/authorization-request-tab" alt="The Auth tab of a request with OAuth 2.0 and the Authorization Code with PKCE grant selected" width=1600 height=1050 %}

## Inheritance

To use the same credentials for many requests, set them on the collection or on a folder, and choose **Inherit from parent** on the requests. Trufos then walks up from the request: the first folder with its own authorization wins, otherwise the collection's is used. Below the type, Trufos shows where the inherited authorization comes from.

The types you can choose depend on where you are:

| Level      | None | Inherit from parent | Basic, Bearer, Digest, OAuth 1.0, OAuth 2.0 |
| ---------- | :--: | :-----------------: | :-----------------------------------------: |
| Request    | ✓    | ✓                   | ✓                                           |
| Folder     |      | ✓                   | ✓                                           |
| Collection | ✓    |                     | ✓                                           |

New requests start with **None**. A folder without an authorization of its own passes on the one of its parent.

## Basic Auth

Enter a **Username** and **Password**. Trufos sends them in the `Authorization: Basic …` header.

## Bearer Token

Enter the **Token**, for example a JWT. Trufos sends it as `Authorization: Bearer <token>`.

## Digest Auth

Enter a **Username** and **Password**. To get the server's challenge, Trufos first sends the request without its body, then sends it again with the answer to the challenge. The algorithms MD5, SHA-256 and SHA-512-256 are supported; if the server offers several, Trufos uses the strongest.

## OAuth 1.0

Choose a **Flow**:

- **Existing Token / Two-legged**: enter the **Consumer Key** and **Consumer Secret**, and an **Access Token** and **Token Secret** if you already have them. Leave the token fields empty for two-legged OAuth.
- **Authorization (3-legged)**: enter the **Request Token URL**, **Authorization URL**, **Access Token URL** and **Callback URL** of the service. When you send the request, Trufos opens a login window. After you have logged in, Trufos catches the redirect to the callback URL and fetches the access token.

For both flows, choose the **Signature Method** (HMAC-SHA1, HMAC-SHA256 or PLAINTEXT) and, if the service needs one, a **Realm**.

## OAuth 2.0

Choose a **Grant Type**:

| Grant type                       | Use it when                                                                       |
| -------------------------------- | --------------------------------------------------------------------------------- |
| **Client Credentials**           | A service calls the API on its own behalf, without a user logging in             |
| **Authorization Code**           | A user logs in to the authorization server                                        |
| **Authorization Code with PKCE** | A user logs in, and the server requires or recommends PKCE (most do)              |

Then fill in the fields of the grant type:

- **Client ID** and **Client Secret** of your app as registered with the authorization server.
- **Issuer URL**, **Access Token URL** and, for the authorization code grants, the **Authorization URL**. See [Fill in the endpoints from the issuer](#fill-in-the-endpoints-from-the-issuer).
- **Scope**: the scopes to ask for, separated by spaces. Optional.
- **Client Authentication**: whether the client ID and secret are sent as a Basic Auth header (the default) or in the request body. Your authorization server's documentation says which one it expects.
- For the authorization code grants, the **Callback URL** registered for your app. **State** and, with PKCE, the **Code Verifier** are generated if you leave them empty. With PKCE, keep the **Code Challenge Method** at **S256** unless the server only supports **Plain**.

When you send the request, Trufos gets a token and adds it as `Authorization: Bearer <token>`. For the authorization code grants, it opens a login window first and catches the redirect to the callback URL, so the callback URL does not have to be reachable. **Keep Browser Session Cache** keeps you logged in in that window, so you do not have to log in again each time.

Trufos keeps tokens in memory until it quits and reuses them for later requests. It gets a new token shortly before the old one expires, using the refresh token if the server issued one. Tokens are never written to disk.

### Fill in the endpoints from the issuer

If your authorization server supports OpenID Connect discovery (Keycloak, Entra ID, Auth0, Okta and most others do), you only need its issuer URL. Enter it under **Issuer URL** and click **Discover**: Trufos fetches the server's metadata and fills in the **Access Token URL** and the **Authorization URL**.

In the collection settings, **Discover** uses the saved variables and client certificate of the collection, so save your changes first if the issuer URL contains a variable you just edited.

## Client certificates (mTLS)

Some servers require a client certificate. Set it up per collection: open **Collection settings** › **mTLS** and click **Add Certificate**.

- **Certificate**: the client certificate as a `.pem` or `.crt` file.
- **Private Key** (optional): the key as a `.pem` or `.key` file, if it is not in the certificate file.
- **CA Certificate** (optional): the certificate of the CA that signed the server's certificate, for servers with a certificate from a private CA. It is used in addition to the CAs your system trusts.

Trufos notices when the files change, so you can replace an expired certificate without restarting. The paths are saved in the collection, so team members need the files at the same place, or each of them sets their own paths.

## Server certificates

Trufos checks the TLS certificate of every server it connects to. To send requests to a server with a self-signed or otherwise invalid certificate, for example a local development server, open **Settings** (bottom left of the sidebar, or <kbd>Ctrl</kbd>+<kbd>,</kbd> / <kbd>Cmd</kbd>+<kbd>,</kbd>) and turn off **Verify TLS certificates** in the **General** tab. The setting applies to all collections; turn it back on when you are done. For a server with a certificate from a private CA, adding the **CA Certificate** in the mTLS settings is the safer option.

## How credentials are stored

Passwords, tokens, client secrets and the other fields of an authorization are not saved in the collection's JSON files. Trufos saves them in `.secrets.bin` files next to them, encrypted with your operating system's credential store (Keychain on macOS, DPAPI on Windows, the Secret Service or KWallet on Linux). These files are listed in the collection's `.gitignore`, so they never end up in Git. After cloning a shared collection, each team member enters their own credentials.
