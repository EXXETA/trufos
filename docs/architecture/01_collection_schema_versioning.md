# Collection Schema Versioning

To ensure backwards compatibility while allowing for schema changes, we use a versioning system for
persisted collection, folder, and request schemas. This allows us to make changes to the schema
without breaking existing data.

At the time of writing, the current version is `1.0.1` which is applied hard-coded during
persistence. This ADR describes the steps needed to update the schema version while maintaining
backwards compatibility.

## Creation of Migration Scripts

For every schema change, a migration script must be created. This script is used to update an
info file of the previous schema version to the new schema version. The script is executed
during the loading of a collection, folder, or request. This will allow any version gaps to be
filled in since migration scripts are be executed in order.

Each created migration script must define a `from` version. It also needs a method to map
any `InfoFile` (collection, folder, or request) from the `from` version to a higher version. At the
time of implementation, the target schema will always be the latest.

In order to provide a consistent way to update the schema version, an abstract base class
`InfoFileMapper` has been created. It ensures that the `from` version is correctly set at compile
time using generics. An example of a migration script is shown below (see [
`v1-0-1.ts`](/src/main/persistence/service/info-files/v1-0-0.ts)):

```ts
import { InfoFile as OldInfoFile, VERSION as OLD_VERSION } from './v1-0-0';

// other imports and type definitions

/**
 * Maps schema `v1.0.0` to `v1.0.1`.
 *
 * Changes:
 * - Adds an `id` property which will now be persisted.
 */
export class InfoFileMapper extends AbstractInfoFileMapper<OldInfoFile, InfoFile> {
  public readonly fromVersion = OLD_VERSION.toString();

  async migrate(old: InfoFile) {
    return Object.assign(old, { id: randomUUID(), version: VERSION.toString() });
  }
}
```

## Updating a Schema

1. Copy the current latest version `v{major}-{minor}-{patch}.ts` to a file matching the new schema
   version.
2. Make the necessary schema changes in the new file.
3. Create a new subclass of `AbstractInfoFileMapper` in the previous version to map it to the new
   schema version. The `fromVersion` property should be set to the previous version. For safety,
   also remove all exports except `VERSION` and `InfoFile` in that file.
4. Add your new migrator to the `MIGRATORS` array in `migrators.ts`.
5. Modify the imports in `latest.ts` to point to the new schema file.
6. Modify the `toInfoFile()` method in `latest.ts` to generate the new schema.

That's it! The schema is now updated and the migration script will be executed during the loading of
the collection, folder, or request.