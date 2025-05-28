---
title: Environment Service
nav_order: 1
parent: Core Services
---

# Environment Service

**Location**: `src/main/environment/service/environment-service.ts`

The `EnvironmentService` is a crucial main process service responsible for managing the application's contextual data, including the currently active collection, its environments, and the resolution of variables.

## Responsibilities

*   **Current Collection Management**:
    *   Holds a reference to the `currentCollection` being worked on.
    *   Manages the `currentEnvironmentKey` to specify which environment within the collection is active.
    *   Provides a getter for `currentEnvironment` based on the `currentCollection` and `currentEnvironmentKey`.
*   **Variable Management**:
    *   **Hierarchy**: Resolves variables based on a defined hierarchy:
        1.  Active Environment variables (if an environment is selected).
        2.  Collection variables.
        3.  System variables (dynamic, like `$timestampIso`, `$randomUuid`).
    *   See [Variables documentation]({% link documentation/user-guide/variables.md %}) for details on variable types and usage.
    *   `getVariables()`: Returns all currently available variables (merged from environment, collection, and system).
    *   `getVariable(key)`: Retrieves a single variable object based on the hierarchy.
    *   `getVariableValue(key)`: Retrieves the string value of a variable.
    *   `setCollectionVariables(variables)`: Updates the variables for the `currentCollection`.
*   **Variable Substitution**:
    *   `setVariablesInStream(stream)`: Uses `template-replace-stream` to replace template variables (e.g., `{{my_var}}`) in a `Readable` stream with their resolved values. This is used for processing request bodies.
*   **Collection Lifecycle**:
    *   `init()`: Initializes the service by loading the last used collection (determined by `SettingsService`) or the default collection if the last one fails.
    *   `changeCollection(collectionOrPath)`: Switches the `currentCollection`. If a path is provided, it loads the collection via `PersistenceService`. Updates `SettingsService` with the new current collection.
    *   `closeCollection(path?)`: Removes a collection from the list of open collections in `SettingsService`. If the closed collection was active, it switches to the default collection. The default collection cannot be closed.
    *   `listCollections()`: Retrieves a list of all known/open collections by querying `SettingsService` and loading basic info for each via `PersistenceService`.

## Interactions with Other Services

*   **`PersistenceService`**:
    *   Relies on `PersistenceService` to load collection data from the file system (`loadCollection`).
    *   When collection variables are updated via `setCollectionVariables`, the `EnvironmentService` itself does not directly save. The `RendererEventService` calls `MainEventService.setCollectionVariables` which in turn calls `EnvironmentService.setCollectionVariables` and then explicitly calls `PersistenceService.saveCollection` to persist the changes.
*   **`SettingsService`**:
    *   Reads the list of known collections and the current collection index from `SettingsService` during initialization and when listing/changing collections.
    *   Updates `SettingsService` when collections are changed or closed.
*   **System Variables (`src/main/environment/service/system-variable.ts`)**:
    *   Uses `getSystemVariable(key)` and `getSystemVariables()` to access predefined dynamic variables (e.g., `$timestampIso`, `$randomInt`).

## Key Concepts

*   **Environments**: Collections can have multiple environments (e.g., "Development", "Staging", "Production"), each with its own set of variables. The `EnvironmentService` allows switching between these. (Note: The UI for managing environments beyond variable setting in the collection's root settings might be a future feature, as `environments` map exists in `Collection` type, but UI mainly focuses on collection-level vars for now).
*   **Variable Resolution**: The layered approach to variable resolution (environment > collection > system) allows for flexible configuration and overrides.

The `EnvironmentService` acts as the central hub for contextual data that can influence how requests are made and data is interpreted within Trufos. 