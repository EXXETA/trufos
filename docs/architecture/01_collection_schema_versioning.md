# Collection Schema Versioning

To ensure backwards compatibility while allowing for schema changes, we use a versioning system for
persisted collection, folder, and request schemas. This allows us to make changes to the schema
without breaking existing data.

The current version is the one [`latest.ts`](/src/main/persistence/service/info-files/latest.ts)
re-exports. This ADR describes the steps needed to update the schema version while maintaining
backwards compatibility. [`AGENTS.md`](/AGENTS.md) lists when a new version is needed.

## Creation of Migration Scripts

For every schema change, a migrator must be created. It updates an info file of the previous schema
version to the new schema version. Migrators run in order when a collection, folder, or request is
loaded (`migrateInfoFile()` in
[`migrators.ts`](/src/main/persistence/service/info-files/migrators.ts)), so any version gap is
filled in. An info file with a version newer than the latest one is rejected.

Each migrator defines the version it migrates from in `fromVersion` and maps an info file of that
version to the next one. `AbstractInfoFileMigrator`
([`migrator.ts`](/src/main/persistence/service/info-files/migrator.ts)) ensures at compile time that
`fromVersion` matches its input schema. The migrator lives in the file of the version it migrates
to, and its doc comment lists the changes, e.g. in
[`v2-6-0.ts`](/src/main/persistence/service/info-files/v2-6-0.ts):

```ts
import { InfoFile as OldInfoFile, VERSION as OLD_VERSION } from './v2-5-0';

// other imports and schemas

/**
 * Migrates schema `v2.5.0` to `v2.6.0`.
 *
 * Changes:
 * - Adds the authorization type `digest` (HTTP Digest authentication) with a username and a
 *   password. Older versions cannot read it, so they reject the newer version instead.
 */
export class InfoFileMigrator extends AbstractInfoFileMigrator<OldInfoFile, InfoFile> {
  public readonly fromVersion = OLD_VERSION.toString();

  async migrate(old: OldInfoFile, _type: TrufosObjectType, _filePath: string): Promise<InfoFile> {
    return Object.assign(old, { version: VERSION.toString() });
  }
}
```

## Updating a Schema

1. Copy the current latest version `v{major}-{minor}-{patch}.ts` to a file matching the new schema
   version.
2. Make the necessary schema changes in the new file.
3. Replace the `InfoFileMigrator` in the new file with one that migrates from the previous version.
4. Add your new migrator to `MIGRATOR_ARRAY` in `migrators.ts`.
5. Modify the imports in `latest.ts` to point to the new schema file, and adjust `toInfoFile()` if
   the new schema needs it.
6. Create a test for the new migrator next to it.
7. Update the `version` in `examples/collection/`.

That's it! The schema is now updated and the migrator will be executed during the loading of the
collection, folder, or request.
