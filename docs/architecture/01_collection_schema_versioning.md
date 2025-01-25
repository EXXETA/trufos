# Collection Schema Versioning

To ensure backwards compatibility while allowing for schema changes, we use a versioning system for
persisted collection, folder, and request schemas. This allows us to make changes to the schema
without breaking existing data.

The current version is `1.0.0` which is applied hard-coded during persistence. This ADR describes
the steps needed to update the schema version while maintaining backwards compatibility.

## Creation of Migration Scripts

For every schema change, a migration script must be created. This script will be used to update an
info file of the previous schema version to the new schema version. The script will be executed
during the loading of a collection, folder, or request. This will allow any version gaps to be
filled in since migration scripts will be executed in order.

Each created migration script must define a `from` version. It also needs a method to map
any `InfoFile` (collection, folder, or request) from the `from` version to a higher version. At the
time of implementation, the target schema will always be the latest.

In order to provide a consistent way to update the schema version, an abstract base class
`InfoFileMapper` has been created. It ensures that the `from` version is correctly set at compile
time using generics. An example of a migration script is shown below:

```ts
/**
 * Maps schema `v1.0.0` to `v1.0.1`.
 *
 * Changes:
 * - Adds an `id` property which will now be persisted.
 */
export class InfoFileMapperV1_0_0 extends InfoFileMapper<InfoFileOld, InfoFile> {
  public readonly fromVersion = OLD_VERSION;

  async migrate(old: InfoFileOld) {
    return Object.assign(old, { id: randomUUID(), version: VERSION });
  }
}
```

## Updating a Schema

1. Copy the current `InfoFile` schema from `latest.ts` to a new file named
   `v{major}-{minor}-{patch}.ts` matching the current version.
2. Modify the schema and `toInfoFile` method in `latest.ts` to reflect the changes.
3. Create a new migration script for the previous schema version to the new schema version in a new
   file. The file should be named `mapper-v{major}-{minor}-{patch}.ts` and located next to the base
   `InfoFileMapper` class.

That's it! The schema is now updated and the migration script will be executed during the loading of
the collection, folder, or request.