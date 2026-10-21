# Plugin Architecture

Issue: [#1073](https://github.com/EXXETA/trufos/issues/1073)

Trufos gets a plugin API so features can be added without every user carrying them. Plugins are
first-party for the foreseeable future. The architecture is staged: the first stage ships plugins
inside the app and introduces no new runtime, but the API contract is designed so that later stages
(separate downloads, third-party plugins in a sandbox) only change how plugin code is loaded, not
what a plugin looks like.

## Goals and non-goals

Goals, in order:

1. A single, typed contribution API that the existing extensible features (importers, exporters,
   authentication types, menu entries, commands) move onto. The hard-coded `switch` in
   `createAuthStrategy()` and the `ImportStrategy` / `ExportStrategy` unions become registries.
2. Lazy activation: a plugin's code is loaded on first use of one of its contributions, never at
   startup. Declarative contributions (menu entries, commands, panels) are rendered from the
   manifest without loading the plugin.
3. Heavy dependencies (`postman-collection`, `@usebruno/lang`, `@readme/openapi-parser`, later
   `@grpc/grpc-js`, a git implementation) live in plugin packages, not in the app bundle.
4. An API shape that can be put behind a process boundary later without changing plugins.

Non-goals for the first stages:

- Sandboxing or enforcing permissions against malicious code. Every plugin is ours; a sandbox
  between us and our own code protects nobody. Permissions are declared and shown, and the host
  API handed to a plugin is built from them, but nothing stops a plugin that lies.
- A marketplace, third-party publishing, or an npm-published API package.
- Running user scripts (pre-request, post-response) through the plugin system. That is a separate
  concern: those scripts are third-party code today and run in `node:vm`, which is not a sandbox.

## Staging

| Stage | What changes                                                                                            | When                                               |
| ----- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| 1     | Contribution API, manifest, registries, lazy loading. Plugins are Yarn workspaces bundled into the app. | now                                                |
| 1.5   | Renderer contributions: plugins mount React components into host-provided slots.                        | first plugin that needs its own panel (git)        |
| 2     | Downloadable plugins: signed zips attached to the Trufos GitHub release, a Plugins page in settings.    | first plugin heavy enough to not ship by default   |
| 3     | Third-party plugins: one sandboxed renderer per plugin, broker in main, enforced permissions.           | only if a plugin we did not write is ever accepted |

Protocol plugins (gRPC, WebSocket, SSE) additionally need the request and response model to be
generalised over a `protocol` discriminator. That is its own issue; it is listed under
[Protocol plugins](#protocol-plugins) so the API is designed with it in mind.

## Design rules

These are the rules that are cheap now and impossible to retrofit. Every API addition is checked
against them in review.

1. **Message-shaped API.** Every host call is asynchronous and takes and returns plain data that is
   validated with Zod. A plugin never receives a store, a service instance, an Immer draft, a Node
   stream object it could keep, or a callback into the host beyond the ones it registers through the
   API. The renderer already talks to main this way; plugins talk to main the same way.
2. **Plugins never hold secrets.** A plugin describes a request (method, path, headers, references
   to variables); the host resolves variables and attaches authentication. Secret variables and
   authentication data are never passed to plugin code. A plugin that needs its own secrets gets a
   per-plugin store backed by `safeStorage`.
3. **Bodies cross the boundary as streams.** Request and response bodies are opened by id and
   returned as a `ReadableStream`, never as a string or buffer (see `shim/ipc-stream.ts`). This is
   the same rule the app follows (AGENTS.md).
4. **Collection changes go through commands.** A plugin changes the open collection by dispatching a
   `CollectionCommand` and learns about changes by subscribing to the same patches the renderer
   gets. There is no second way to mutate the model.
5. **The host API is derived from the manifest's permissions.** A plugin without
   `collection:write` is handed a host object without `dispatch()`. This keeps declarations truthful
   without a sandbox and gives stage 3 a precise list of what to enforce.
6. **One public entry point.** Plugins import only from `shim/plugin`. Everything else in `src/` is
   private to the app. An ESLint `no-restricted-imports` rule in `plugins/` enforces it.

## Repository layout

Plugins live in this repository as Yarn workspaces. The plugin API changes often in the first
year; in one repository an API change and the plugin updates that go with it are one pull request,
one CI run and one review. A separate repository would live under the same organisation anyway and
only add a version matrix. A plugin is split out with `git subtree split` when it gets external
contributors or its own release cadence.

```
package.json                  workspaces: ["plugins/*"]
src/shim/plugin/              the plugin API: manifest schema, host API types, contribution types
src/main/plugin/              PluginService: discovery, validation, activation, routing
src/renderer/plugin/          contribution rendering, slots (stage 1.5)
plugins/
  postman/
    package.json              @trufos/plugin-postman, own dependencies (postman-collection)
    plugin.json               manifest
    src/main.ts               main-process entry: activate(host) => PluginInstance
    src/renderer.tsx          renderer entry (stage 1.5, optional)
    src/*.test.ts
  bruno/
  openapi/
  git/
```

Each plugin's `package.json` declares its own dependencies with exact versions. Yarn's
`nodeLinker: node-modules` hoists them; nothing changes for `yarn install --immutable`.

`yarn typecheck` gains `tsc -p plugins/<name>` per plugin (or one `plugins/tsconfig.json` with
project references). `yarn test` picks plugins up through a Vitest workspace entry. `yarn lint`
already covers the directory.

## Manifest

`plugin.json`, validated with `PluginManifest` from `shim/plugin/manifest.ts`:

```json
{
  "id": "postman",
  "name": "Postman",
  "version": "1.0.0",
  "description": "Imports and exports Postman v2.1 collections.",
  "engine": "^1.0.0",
  "main": "main.js",
  "renderer": "renderer.js",
  "permissions": ["collection:read", "collection:write", "fs:collection"],
  "contributes": {
    "importers": [{ "id": "postman", "name": "Postman", "extensions": ["json"] }],
    "exporters": [{ "id": "postman", "name": "Postman v2.1", "extensions": ["json"] }],
    "commands": [{ "id": "commit", "title": "Git: Commit…", "when": "collectionOpen" }],
    "menus": { "collection": [{ "command": "commit" }] },
    "panels": [{ "id": "status", "title": "Git", "slot": "sidebar", "icon": "git-branch" }],
    "authTypes": [{ "id": "aws-sigv4", "name": "AWS Signature v4" }],
    "requestHooks": true,
    "responseHooks": true
  }
}
```

- `id` is the namespace for everything the plugin contributes: the command above is `postman.commit`
  outside the plugin. Ids are `[a-z][a-z0-9-]*`.
- `engine` is a semver range on the **plugin API version** (`PLUGIN_API_VERSION` in
  `shim/plugin/version.ts`), not on the app version. The API version follows semver: a breaking
  change to `shim/plugin` bumps the major. `main/util/semver.ts` is extended with range matching
  if it does not have it.
- `main` is the main-process bundle; `renderer` is optional until stage 1.5.
- `permissions` is a closed Zod enum. Initial set:

  | Permission               | Grants                                                    |
  | ------------------------ | --------------------------------------------------------- |
  | `collection:read`        | `host.collection.getState()`, `onChange()`                |
  | `collection:write`       | `host.collection.dispatch()`                              |
  | `bodies:read`            | `host.bodies.open()`                                      |
  | `fs:collection`          | `host.fs` scoped to the open collection's directory       |
  | `fs:pick`                | `host.ui.pickFile()`, `pickDirectory()`, `pickSavePath()` |
  | `network:<host pattern>` | `host.fetch()` to matching hosts                          |
  | `exec:<binary>`          | `host.exec()` for the named binary (git)                  |
  | `secrets`                | `host.secrets` per-plugin store                           |

- `contributes` is the only thing the app needs before the plugin is activated. Everything in it is
  rendered or registered from the manifest alone.

## Main-process API

`shim/plugin/host.ts` defines what a plugin sees. Sketch:

```ts
export interface PluginHost {
  readonly log: PluginLogger; // winston child logger with the plugin id
  readonly collection?: {
    getState(): Promise<CollectionSnapshot>;
    onChange(listener: (event: CollectionStateEvent) => void): Disposable;
    dispatch?(command: CollectionCommand): Promise<number>; // collection:write
    readonly dirPath: string;
  };
  readonly bodies?: { open(bodyId: string): Promise<ReadableStream<Uint8Array>> };
  readonly fs?: PluginFileSystem; // path-scoped: every path is resolved inside the collection dir
  readonly fetch?: typeof fetch; // host-provided, permission-checked by host pattern
  readonly exec?: (args: string[], options?: ExecOptions) => Promise<ExecResult>;
  readonly storage: PluginStorage; // JSON, userData/plugins/<id>/storage.json
  readonly secrets?: PluginSecrets; // safeStorage-backed, per plugin
  readonly ui: {
    showMessage(message: string, level?: 'info' | 'warn' | 'error'): void;
    confirm(options: ConfirmOptions): Promise<boolean>;
    prompt(options: PromptOptions): Promise<string | undefined>;
    pickFile?(options: OpenDialogOptions): Promise<string | undefined>;
  };
}

export interface PluginInstance {
  importers?: Record<string, CollectionImporter>;
  exporters?: Record<string, CollectionExporter>;
  authTypes?: Record<string, AuthStrategyFactory>;
  commands?: Record<string, (context: CommandContext) => Promise<void>>;
  requestHooks?: RequestHook[];
  responseHooks?: ResponseHook[];
  deactivate?(): Promise<void>;
}

export type PluginActivate = (host: PluginHost) => Promise<PluginInstance> | PluginInstance;
```

Points to keep when filling this in:

- `CollectionImporter` and `CollectionExporter` are the interfaces that already exist in
  `main/import/service/import-service.ts` and `main/export/service/export-service.ts`. They move
  to `shim/plugin` unchanged; the services keep their registries but fill them from
  `PluginService`.
- `AuthStrategy` (`main/network/authentication/auth-strategy.ts`) already has the right shape:
  `getAuthHeader(context)` with method and URL. A plugin auth type is a factory from validated
  auth data to such a strategy. The auth data schema for a plugin type is `z.looseObject` tagged
  with the plugin's type id; the plugin validates the rest.
- Request and response hooks mirror Insomnia's: a hook gets a request description it can edit
  (headers, query, body reference) or a response description with `openBody()`. Hooks run in
  `HttpService` next to the existing pre-request and post-response scripts, after the scripts.
- `fetch` is undici's, wrapped so that the host of every URL is checked against the plugin's
  `network:` permissions. In stage 1 the check only logs a violation; in stage 3 it throws.
- Every method of `PluginHost` is wrapped so that a throwing plugin never takes the app down:
  errors are logged with the plugin id and surfaced as a `DisplayableError` where a user action
  caused them.

## PluginService

`src/main/plugin/plugin-service.ts`, a singleton with `init()` like the other services, initialised
in `main.ts` after `SettingsService` and before `CollectionStateService`.

Responsibilities:

1. **Discovery.** Stage 1: a static registry of bundled plugins, each as a manifest plus a lazy
   import:

   ```ts
   const BUNDLED: BundledPlugin[] = [
     { manifest: postmanManifest, load: () => import('@trufos/plugin-postman') },
     ...
   ];
   ```

   Vite splits each dynamic import into its own chunk, so bundled plugins already cost nothing at
   startup. Stage 2 adds `userData/plugins/<id>/<version>/` directories with a `plugin.json` and
   a signature check.

2. **Validation.** Every manifest is parsed with `PluginManifest`. An invalid manifest, an
   `engine` range the current API does not satisfy, or a duplicate id disables the plugin with a
   logged reason that the Plugins page shows.
3. **Contribution index.** From the manifests alone, the service builds the lists the app needs:
   importers and exporters with their file filters, commands, menu entries, auth types, panels.
   The renderer gets them through `IEventService.getPluginContributions()` and a
   `MainProcessEvent.PluginsChanged` event when they change (enable, disable, install).
4. **Activation.** The first time a contribution is used, the service loads the plugin's `main`
   entry, builds the `PluginHost` from the manifest's permissions and calls `activate()`. The
   returned `PluginInstance` is cached. Activation errors disable the plugin for the session.
5. **Routing.** `ImportService`, `ExportService`, `createAuthStrategy()`, `HttpService` (hooks),
   `MenuBuilder` and the command palette ask the service by id. Bundled, built-in behaviour that is
   not moved to a plugin (the Zip exporter, Basic/Bearer/OAuth auth) is registered the same way,
   so there is one code path.
6. **State.** `userData/plugins.json` through `JsonFile` with a version and migrators, like
   `settings.json`: per plugin `enabled`, installed version and source (`bundled` or `downloaded`).

Disabled plugins keep their contributions out of the index; nothing else changes.

## Renderer contributions (stage 1.5)

Declarative contributions (commands, menu entries, panels with a title and icon) are rendered by the
app from the contribution index. A command runs through `IEventService.runPluginCommand(id,
context)`; the plugin's handler runs in main.

A plugin that needs its own UI (the git panel: status list, diff, commit log) exports React
components from its `renderer` entry and the app mounts them into **slots**:

| Slot               | Where                                         | Props                 |
| ------------------ | --------------------------------------------- | --------------------- |
| `sidebar`          | a tab next to requests and history            | `collection`          |
| `main-tab`         | a tab in the main area                        | `collection`          |
| `settings-section` | a section in the app settings modal           | –                     |
| `request-editor`   | the request editor for a protocol (see below) | `request`, `dispatch` |
| `response-view`    | the response panel for a protocol             | `response`            |

The renderer entry is loaded in-process with `import()`. It must share the host's React instance,
so plugin renderer bundles externalise `react`, `react-dom` and the UI kit and resolve them against
a host runtime object that `src/renderer/plugin/runtime.ts` exposes. Plugin components use the
same shadcn/ui components and Tailwind classes as the app, so they look native. In stage 2 the
bundle is served from the plugin directory through a `trufos-plugin://` protocol registered with
`protocol.handle()`; in stage 1 it is a code-split chunk like the main entry.

The renderer part talks to its main part only through the plugin's commands and the shared
collection state. It gets no renderer-internal stores. This keeps the in-process module replaceable
by a sandboxed iframe for stage 3: a slot that takes a component today takes an iframe tomorrow.

## Protocol plugins

`TrufosRequest` (`shim/objects/request.ts`) is HTTP-shaped: `method`, `url`, `headers`, a closed
`RequestBody` union. The response model, `HttpService`, the body store, history and the editor
components are HTTP-shaped too. gRPC (and WebSocket, SSE) need:

1. A `protocol` discriminator on requests and responses, with `http` built in and plugin protocols
   carrying a `data` object that only the owning plugin validates and understands. The core
   (sidebar, drafts, persistence, commands, history) treats requests generically.
2. A `protocols` contribution: main side `send(request, signal)` returning a stream of response
   events (gRPC streams several messages); renderer side the `request-editor` and `response-view`
   slots.
3. History and the body store accepting a sequence of bodies per response.

This is the largest model change since main-owned collection state and gets its own issue. The
plugin API is designed with it in mind (slots and the event-stream shape of `send`) but it is
implemented after stages 1 and 1.5.

## Deployment (stage 2)

Today a push to the `release` branch runs `release.yml`, which publishes the app with
`@electron-forge/publisher-github` to `EXXETA/trufos` as a prerelease, and the app updates itself
through `update-electron-app` from those assets. Plugins ride on the same release.

- **Artifact:** one zip per plugin containing `plugin.json`, `main.js`, optionally `renderer.js`
  and assets. Plugin version = app version; the plugin built in the same CI run as the app is the
  one it loads. No registry file and no compatibility matrix until plugin versions need to diverge.
- **Download URL:** `https://github.com/EXXETA/trufos/releases/download/v<appVersion>/<id>.zip`.
- **Signing:** an Ed25519 key pair. The private key is a GitHub Actions secret, the public key is
  embedded in the app. CI signs each zip and uploads `<id>.zip.sig`; the app verifies with
  `node:crypto` before unpacking. Main loads plugin code from `userData`, which the
  `OnlyLoadAppFromAsar` fuse does not cover, so the signature is what keeps "only our code runs in
  main" true.
- **CI:** `ci.yml` builds every plugin and validates each `plugin.json` against the schema.
  `release.yml` gets a `plugins` job with `needs: build_and_test`, Ubuntu only (bundles are
  platform-independent), that builds, zips, signs and runs
  `gh release upload v<version> plugins/dist/*.zip plugins/dist/*.sig --clobber`. Forge creates
  the release first, so the tag exists; `GITHUB_TOKEN` with `contents: write` is already there.
- **In-app management:** a Plugins page in settings lists the catalogue the running version knows
  (bundled with the app, since it equals the release's plugin list) with install, enable, disable
  and uninstall. Install downloads in main with undici into a `FileSystemService.temporaryFile()`,
  verifies the signature, unzips with `@zip.js/zip.js` and moves the directory into place. After an
  app update, installed plugins are re-downloaded at the new version on first start.
- **Development:** `yarn start` loads plugins from the workspaces, no zip and no signature. A
  `TRUFOS_PLUGIN_DIR` environment variable sideloads an unpacked plugin; signature checks are
  skipped only in unpackaged builds, the same gate as the `CI` safe-storage fallback in `main.ts`.

## Testing

- Plugins have unit tests next to their sources, run by the root `yarn test` through a Vitest
  workspace entry. Importer tests move with the importers.
- `PluginService` has contract tests: manifest validation, engine range, duplicate ids, lazy
  activation (the entry is not imported before first use), host API shape per permission set,
  error isolation (a throwing plugin does not break the service).
- A `plugins/__fixtures__/` test plugin with every contribution type is used by the service tests
  and by an e2e spec that imports a collection through a plugin importer.
- The e2e suite is run by the developer or CI, not by agents (AGENTS.md).

## Migration of existing features

In this order, each as its own pull request:

1. `shim/plugin` with manifest, host and contribution types, `PluginService` with the bundled
   registry, `plugins.json` state, the Plugins page listing bundled plugins with enable/disable.
2. Importers and exporters: `ImportService` and `ExportService` fill their registries from
   `PluginService`; `ImportStrategy` and `ExportStrategy` become ids. `plugins/postman`,
   `plugins/bruno`, `plugins/openapi` with their dependencies; the Zip exporter stays built in.
   `CollectionImport.tsx` renders the strategy list and file filters from the contribution index.
3. Auth types: `createAuthStrategy()` becomes a registry lookup; built-in types register
   themselves. No plugin yet, but the seam exists.
4. Commands and menus: `MenuBuilder` and the command palette include plugin contributions.
   Request and response hooks in `HttpService`.
5. Git plugin, which drives stage 1.5 (slots and the renderer runtime).
6. Protocol generalisation, then the gRPC plugin.

## Open questions

- Range matching in `main/util/semver.ts`: add it, or keep `engine` to a major version only?
- Whether `utilityProcess` works with the `RunAsNode` fuse disabled. Only relevant if a trusted
  native tier is ever wanted; stage 3 as designed does not need it.
- Signature check once at install or on every load. The plugin directory is in the user's own
  profile, so once at install is probably enough.
- Whether the Zip exporter and the built-in auth types should become plugins for consistency, or
  stay built in and simply register through the same API.
