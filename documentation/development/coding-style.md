---
title: Coding Style & Formatting
nav_order: 1
parent: Development Practices
---

# Coding Style & Formatting

To maintain consistency and readability across the codebase, Trufos employs automated tools for code formatting and linting.

## Code Formatting: Prettier

[Prettier](https://prettier.io/) is an opinionated code formatter used to ensure a consistent code style.

*   **Configuration**: `.prettierrc`
    ```json
    {
      "trailingComma": "es5",
      "tabWidth": 2,
      "semi": true,
      "singleQuote": true,
      "printWidth": 100
    }
    ```
*   **Usage**:
    *   **Check Formatting**:
        ```bash
        yarn prettier-check
        ```
        This command checks all TypeScript (`.ts`, `.tsx`) files for formatting issues without modifying them.
    *   **Apply Formatting**:
        ```bash
        yarn prettier
        ```
        This command automatically reformats all TypeScript files according to the defined style.
*   **IDE Integration**: It is highly recommended to integrate Prettier into your IDE to format code automatically on save.
    *   **VS Code**: Install the [Prettier - Code formatter](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) extension. The project includes `.vscode/settings.json` which should enable format-on-save with Prettier for TypeScript files.
    *   **IntelliJ (WebStorm, etc.)**:
        1.  Install the "Prettier" plugin from the JetBrains Marketplace.
        2.  Configure it to run on save: Go to `Settings/Preferences` > `Languages & Frameworks` > `JavaScript` > `Prettier`. Enable "Run on save". Ensure "Run for files" includes `*.ts` and `*.tsx`.
        (Alternatively, the `CONTRIBUTING.md` suggests using "Save Actions X" plugin for IntelliJ.)

## Linting: ESLint

[ESLint](https://eslint.org/) is used for static analysis to find problematic patterns or code that doesn't adhere to certain style guidelines.

*   **Configuration**:
    *   `eslint.config.mjs` (Flat Config - preferred)
    *   `.eslintrc.json` (Legacy - might be partially used or in transition. The `eslint.config.mjs` indicates a move to flat config.)

    The configuration extends several recommended rule sets:
    *   `eslint:recommended`
    *   `plugin:@typescript-eslint/recommended`
    *   `plugin:import/recommended` (for import statement linting)
    *   `plugin:import/electron`
    *   `plugin:import/typescript`

    Key settings include:
    *   Parser: `@typescript-eslint/parser`
    *   Import resolver for TypeScript paths.
    *   Rule `import/no-unresolved` set to `error`.

*   **Usage**:
    ```bash
    yarn lint
    ```
    This command runs ESLint on all `.ts` and `.tsx` files and reports any errors or warnings.

## General Guidelines

*   Follow the established coding style present in the project.
*   Write clear and concise code.
*   Add comments to explain complex logic or non-obvious decisions.
*   Ensure your contributions pass both Prettier checks and ESLint checks before submitting a pull request. 