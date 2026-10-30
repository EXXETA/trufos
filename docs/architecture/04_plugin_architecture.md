# Plugin Architecture

Issue: [#1073](https://github.com/EXXETA/trufos/issues/1073)

Trufos gets a plugin API so features can be added without every user carrying them. Plugins are
first-party for the foreseeable future. The architecture is staged: the first stage ships plugins
inside the app and introduces no new runtime, but the API contract is designed so that later stages
(separate downloads) only change how plugin code is loaded, not what a plugin looks like.

The security model is the one of VS Code extensions: plugins are trusted code that runs in the
app's own process, and what keeps that true is integrity, not isolation. Bundled plugins are part
of the app; downloaded plugins (stage 2) are built and signed by our CI and the app only loads what
it can verify. See [Permissions](#permissions) for what the permission list in a manifest is for.

## Goals and non-goals

Goals, in order:

1. A single, typed contribution API that the existing extensible features (importers, exporters,
   menu entries, commands) move onto. The `ImportStrategy` / `ExportStrategy` unions become
   registries. Authentication types stay in core, see
   [Rejected alternatives](#rejected-alternatives).
2. Lazy activation: a plugin's code is loaded on first use of one of its contributions, never at
   startup. Declarative contributions (menu entries, commands, panels) are rendered from the
   manifest without loading the plugin.
3. Heavy dependencies (`postman-collection`, `@usebruno/lang`, `@readme/openapi-parser`, later
   `@grpc/grpc-js`, a git implementation) live in plugin packages, not in the app bundle.
4. An API shape that can be put behind a process boundary later without changing plugins.

Non-goals for the first stages:

- Sandboxing, consent dialogs or enforcing permissions against malicious code. Every plugin is
  ours; a sandbox between us and our own code protects nobody, and in-process nothing could stop a
  plugin that lies anyway. Permissions are informational and kept truthful by construction, see
  [Permissions](#permissions). What enforcement would look like if a third-party plugin is ever
  accepted is kept in the [appendix](#appendix-third-party-plugins) so it does not get designed
  into the API by accident.
- A marketplace, third-party publishing, or an npm-published API package.
- Running user scripts (pre-request, post-response) through the plugin system. That is a separate
  concern: those scripts are third-party code today and run in `node:vm`, which is not a sandbox.

## Staging

| Stage | What changes                                                                                            | When                                             |
| ----- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| 1     | Contribution API, manifest, registries, lazy loading. Plugins are Yarn workspaces bundled into the app. | now                                              |
| 1.5   | Renderer contributions: plugins mount React components into host-provided slots.                        | first plugin that needs its own panel (git)      |
| 2     | Downloadable plugins: signed zips attached to the Trufos GitHub release, a Plugins page in settings.    | first plugin heavy enough to not ship by default |

There is no planned stage for third-party plugins. The [appendix](#appendix-third-party-plugins)
records what it would take, so the API does not close that door.

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
2. **Bodies cross the boundary as streams.** Request and response bodies are opened by id and
   returned as a `ReadableStream`, never as a string or buffer (see `shim/ipc-stream.ts`). This is
   the same rule the app follows (AGENTS.md).
3. **Collection changes go through commands.** A plugin changes the open collection by dispatching a
   `CollectionCommand` and learns about changes by subscribing to the same patches the renderer
   gets. There is no second way to mutate the model.
4. **Everything outside the app is a capability of the host, and the host is built from the
   manifest.** A plugin reads files, talks to the network or runs a program only through `host.fs`,
   `host.fetch` or `host.exec`, and each capability is only provided if the manifest declares a
   permission of its scope; otherwise it throws on access. This is not security, it is API
   discipline: it keeps the permission list truthful by construction and keeps every host
   capability a named, message-shaped thing, see [Permissions](#permissions).
5. **One public entry point.** Plugins import only from `shim/plugin`. Everything else in `src/` is
   private to the app, and Node's own modules that reach outside the process (`node:fs`,
   `node:child_process`, `node:net`, …) and the global `fetch` are off limits too, because they
   would bypass rule 4. ESLint rules in `plugins/` enforce both; pure helpers such as `node:path`
   and `node:crypto` stay allowed, and test files are exempt.
6. **The entry point is `activate(host)`.** A plugin is a module that exports one function, which
   receives its host and returns its contributions, like a VS Code extension. The host is passed,
   not global, see [Rejected alternatives](#rejected-alternatives).

An earlier draft had a rule that plugins never hold secrets, with the host resolving variables and
attaching authentication. It is dropped: every plugin is our code, and the rule would have ruled
out the contributions that need a secret to do their job. The host still resolves variables and
attaches authentication for ordinary requests, because that is where the code lives, not because a
plugin may not see them. The [appendix](#appendix-third-party-plugins) records that the rule would
have to return for third-party code.

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
`nodeLinker: node-modules` hoists them. Every workspace and its dependencies are part of `yarn.lock`,
so adding a plugin or changing its dependencies needs a `yarn install` and a committed lockfile;
otherwise `yarn install --immutable` fails in CI.

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
- `permissions` are compact strings (`<scope>:<value>` or `<scope>`) from a closed set. The
  schema validates them as strings, so the generated JSON Schema lists them for editors, and parses
  each into an object with a `value` typed per scope (`{ scope: 'network', value: '*.github.com' }`).
  Everything after the manifest works with the objects and switches over `scope`. The scope
  decides which host capability the plugin gets; the value says what the plugin does with it, in
  words the Plugins page shows the user. Initial set:

  | Permission               | Host capability   | Tells the user                            |
  | ------------------------ | ----------------- | ----------------------------------------- |
  | `collection:read`        | `host.collection` | reads the open collection                 |
  | `collection:write`       | `host.collection` | changes the open collection               |
  | `bodies:read`            | `host.bodies`     | reads request and response bodies         |
  | `fs:collection`          | `host.fs`         | accesses any file on the computer         |
  | `fs:pick`                | `host.fs`         | accesses any file on the computer         |
  | `network:<host pattern>` | `host.fetch`      | connects to the named hosts               |
  | `exec:<binary>`          | `host.exec`       | runs the named program (git)              |
  | `secrets`                | `host.secrets`    | stores its own secrets                    |

  Only `host.fs` exists so far; the others are added with the first contribution that needs them.
  `host.fs` is not limited to the area its permission names yet, so `fs:collection` and `fs:pick`
  only state what a plugin intends to access, and the Plugins page shows both as access to any file.
  `host.fs` mirrors Node's `fs/promises` method by method (`readFile`, `writeFile`, later `readdir`,
  `stat`, …), each with the signature of its namesake, so a plugin author and a library that wants
  a Node-shaped `fs` need nothing new. Two deliberate deviations keep the API message-shaped:
  binary data is typed as `Uint8Array` rather than `Buffer`, and methods that return handles or
  watchers (`open()`, `watch()`) are not mirrored. A stream read, if a plugin ever needs one, is a
  web `ReadableStream<Uint8Array>`, the same type bodies use.

- `contributes` is the only thing the app needs before the plugin is activated. Everything in it is
  rendered or registered from the manifest alone.

## Permissions

A permission list that drifts from what the plugin does is worse than none, so the list is not
checked by hand in review. It is kept true by construction:

1. A plugin reaches outside the app through a capability of its host (`host.fs`, later
   `host.fetch`, `host.exec`, …). The lint rule of design rule 5 catches the accidental second
   way: importing `node:fs` or calling the global `fetch` out of habit. It does not catch a
   deliberate workaround such as a dynamic `import()`, and it does not have to; it is a reminder
   for our own code, not a boundary.
2. `createPluginHost()` (`main/plugin/plugin-host.ts`) only provides a capability if the manifest
   declares a permission of its scope. An undeclared capability is a getter that throws
   `The plugin "x" uses host.fs, but its manifest declares no "fs" permission`.
3. Plugins take the capabilities they need in `activate()` and hand them to their importers,
   exporters and so on, instead of reaching for `host.fs` lazily. `bundled-plugins.test.ts`
   activates every bundled plugin with the host built from its manifest, so a missing permission
   fails CI instead of a user's import.

The host does not check the value of a permission: `host.fs` reads any path the plugin passes,
whether or not it is inside the collection, and `host.fetch` will not compare URLs against the
`network:` pattern. The value is what the Plugins page shows the user, and the plugin's code review
is what keeps it honest. A dependency that opens files itself (a library reading a file by path)
is invisible to the lint rule; that blind spot is the same one VS Code has and is accepted.

There is no consent dialog, no stored grant and no re-consent on an update that widens the list.
Bundled plugins are part of the signed app, and downloaded plugins are signed by the same CI, so
installing one is trusting us, the same as updating the app. The Plugins page shows the list so the
user knows what a plugin does, not so they can refuse it.

## Main-process API

`shim/plugin/host.ts` defines what a plugin sees. Sketch:

```ts
// Every capability is typed as present. One whose permission the manifest does not declare throws
// on access, see Permissions. That keeps plugin code free of null checks for what it declared.
export interface PluginHost {
  readonly pluginId: string;
  readonly log: PluginLogger; // winston child logger with the plugin id
  readonly collection: {
    getState(): Promise<CollectionSnapshot>;
    onChange(listener: (event: CollectionStateEvent) => void): Disposable;
    dispatch(command: CollectionCommand): Promise<number>; // collection:write
    readonly dirPath: string;
  };
  readonly bodies: { open(bodyId: string): Promise<ReadableStream<Uint8Array>> };
  readonly fs: PluginFileSystem; // mirrors fs/promises: readFile(), writeFile(), grows with the plugins
  readonly fetch: typeof fetch; // undici's, host-provided
  readonly exec: (args: string[], options?: ExecOptions) => Promise<ExecResult>;
  readonly storage: PluginStorage; // JSON, userData/plugins/<id>/storage.json
  readonly secrets: PluginSecrets; // safeStorage-backed, per plugin
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
- Request and response hooks mirror Insomnia's: a hook gets a request description it can edit
  (headers, query, body reference) or a response description with `openBody()`. Hooks run in
  `HttpService` next to the existing pre-request and post-response scripts, after the scripts.
- `fetch` is undici's. The `network:` pattern of the manifest is shown to the user and not
  checked against URLs, see [Permissions](#permissions).
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

2. **Validation.** Every manifest is parsed with `PluginManifest`. An `engine` range the current
   API does not satisfy disables the plugin with a logged reason that the Plugins page shows. A
   plugin with an invalid manifest or an id that another plugin already has is ignored with a
   logged reason, so plugin ids stay unique; a test keeps the ids of the bundled plugins unique.
3. **Contribution index.** From the manifests alone, the service builds the lists the app needs:
   importers and exporters with their file filters, commands, menu entries, panels.
   The renderer gets them together with the list of plugins as one `PluginsSnapshot` through
   `IEventService.getPlugins()` and a `MainProcessEvent.PluginsChanged` event when they change
   (enable, disable, install).
4. **Activation.** The first time a contribution is used, the service loads the plugin's `main`
   entry, builds the `PluginHost` from the manifest's permissions and calls `activate()`. The
   returned `PluginInstance` is cached. Activation errors disable the plugin for the session.
5. **Routing.** `ImportService`, `ExportService`, `HttpService` (hooks), `MenuBuilder` and the
   command palette ask the service by id. Bundled, built-in behaviour that is not moved to a plugin
   (the Zip exporter) is registered the same way, so there is one code path.
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
by a sandboxed iframe if that is ever needed (see the appendix): a slot that takes a component today
takes an iframe tomorrow.

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
  activation (the entry is not imported before first use), error isolation (a throwing plugin does
  not break the service). `createPluginHost()` has its own: a capability is provided with its
  permission and throws without it.
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
3. Commands and menus: `MenuBuilder` and the command palette include plugin contributions.
   Request and response hooks in `HttpService`. Built on demand, with the first plugin that needs
   them (commands and menus with the git plugin), so their shape comes from a real use instead of
   a guess that the stable API then has to keep.
4. Git plugin, which drives stage 1.5 (slots and the renderer runtime).
5. Protocol generalisation, then the gRPC plugin.

## Open questions

- Whether `utilityProcess` works with the `RunAsNode` fuse disabled. Only relevant if a trusted
  native tier is ever wanted; the appendix design does not need it.
- Signature check of a downloaded plugin once at install or on every load. The plugin directory is
  in the user's own profile, so once at install is probably enough. Bundled plugins are not signed
  at all: they are part of the app's asar, which the app signature and the `OnlyLoadAppFromAsar`
  fuse already cover.

## Rejected alternatives

Decisions taken while building stage 1, with the reasoning, so they are not reopened by accident.

- **The Zip exporter as a plugin.** It writes Trufos' own format and needs the persistence layer and
  the decrypted secrets of a collection (`includeSecrets`), which plugins never get. Its only
  dependency, `@zip.js/zip.js`, stays in core anyway, because stage 2 unzips downloaded plugins
  with it. It implements the same `CollectionExporter` interface as plugin exporters and is
  registered as the built-in `Zip` strategy.
- **`engine` as a major version only.** `SemVer.satisfies()` in `main/util/semver.ts` matches exact
  versions and caret ranges, so a plugin can require the minor version that added an API it uses.

- **Authentication types as plugins.** The seam was planned so a scheme we do not want in core
  (AWS Signature v4, Hawk, a company-specific token) could be a plugin. The cost is out of
  proportion: an auth type is a case in the strategy factory, a member of the shared
  `AuthorizationInformation` union, a form in the request editor, a declaration of which fields
  are secrets so persistence encrypts them, and a mapping in every importer. Making all of that
  pluggable is a large API for three built-in types that have no heavy dependency and nothing to
  lazy-load. Auth stays in core. Revisit only for a scheme with a native or heavy dependency
  (Kerberos, NTLM) or one that must not ship to every user, and even then adding it to core is
  probably cheaper than the seam.
- **Plugins never hold secrets.** Dropped, see [Design rules](#design-rules).
- **The host as a global instead of `activate(host)`.** A global `trufos` like the one the
  scripting sandbox provides only works when every plugin has its own global scope. Bundled plugins
  are code-split chunks of one bundle: same isolate, same module graph, same `globalThis`, so a
  global cannot be per plugin, and two plugins activating concurrently would race on it. Module
  top-level code as the entry point also cannot run again after a disable and re-enable, because ES
  modules evaluate once, and an error at evaluation time is harder to attribute than a rejected
  `activate()`. VS Code, whose extension host is shared like ours, uses `activate(context)` for the
  same reasons. A per-plugin runtime could expose the host as a global and still call `activate()`,
  so nothing is lost.
- **`node:vm` as the plugin runtime.** It is not a security boundary (Node's own documentation
  says so, and the escape is one line), so it would buy only a separate global scope. It would cost
  a separate realm, where every `instanceof`, every `Error` and every `Uint8Array` that crosses the
  line mismatches, a separate single-file bundle per plugin with `require` handed in, experimental
  ES module support, and worse stack traces. If isolation is ever wanted, the appendix design is a
  real boundary at a comparable price.
- **`Pick<typeof fs/promises, …>` for `host.fs`.** It would keep Node's JSDoc but also Node's
  signatures: `FileHandle` as a path argument, `Buffer` as the result, `Stream` and iterables as
  write data, `flag` and `mode` options. All of that would become part of the contract any future
  transport has to honour. The interface is hand-written with the narrowed types and mirrors
  Node's method names and semantics instead.
- **A set for permission lookups.** The lookup runs once per capability when the host is built
  and is captured in a closure; later accesses return the cached instance. Permissions also carry
  values (`network:` patterns, `exec:` binaries) that a set of scopes would lose. A capability
  that ever needs per-call checks builds its own index when it is created.

## Appendix: third-party plugins

Not planned. Recorded so that the API is not designed in a way that rules it out, and so that the
reasoning does not have to be redone. The consistent lesson from other apps (VS Code, Figma,
Obsidian, ajour) is that the runtime is swappable but the API contract is not: Figma swapped their
sandbox engine in days thanks to a thin API layer, Obsidian cannot add one because plugins touch
everything. The design rules above are what keep a swap possible.

If a plugin we did not write is ever accepted, the stakes become real: collections hold API tokens,
OAuth secrets and client certificates. What it would take:

- **Runtime:** one hidden, sandboxed Electron renderer per plugin (Chromium OS sandbox, own session
  partition, no Node), talking to a broker in main over a `MessagePort`. Needs no new dependencies.
  Rejected: `node:vm` (not a boundary), vm2 (deprecated, escape CVEs), Node's permission model
  (documented as not a boundary against malicious code), `utilityProcess` alone (no OS sandbox),
  isolated-vm (native addon, maintenance mode). QuickJS-in-Wasm (Figma's choice) is viable but adds
  a dependency and a slow interpreter.
- **Enforcement:** the broker checks every host call against the manifest. The permission values
  become real: `host.fs` resolves paths inside the collection directory or the picked files only,
  `host.fetch` allowlists hosts by the `network:` pattern, `host.exec` runs the named binary only.
- **Secrets:** the dropped rule that plugins never hold secrets returns. The host resolves
  variables and attaches authentication; secret variables and auth data never reach plugin code.
  Contributions that need a secret to work, such as an auth scheme, stay first-party.
- **Consent (Chrome extension model):** the install dialog lists the permissions; the grant is
  stored per plugin; an update that asks for a permission outside the grant disables the plugin
  until the user accepts the new list. No runtime prompts.
- **Renderer:** slots take an iframe instead of a component.

Because the API is already message-shaped, this changes the transport, not the plugin contract.
