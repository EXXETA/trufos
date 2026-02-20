---
title: Getting Started
nav_order: 2
---

# Getting Started

This guide will walk you through setting up your development environment, building, and running the Trufos application.

## Prerequisites

- **Node.js**: Use version `v24` as specified in the `.nvmrc` file. It's recommended to use a Node version manager like [nvm](https://github.com/nvm-sh/nvm) to manage Node.js versions.
  ```bash
  nvm use 24
  ```
- **Yarn**: Yarn is already included as a dependency in the project, you don't need to install it

## Installation

1.  **Clone the Repository**:

    ```bash
    git clone https://github.com/EXXETA/trufos.git
    cd trufos
    ```

2.  **Install Dependencies**:
    Using Yarn, install all project dependencies:
    ```bash
    yarn install
    ```

## Running in Development Mode

To start the application in development mode with hot reloading and access to developer tools:

```bash
yarn start
```

This command utilizes `electron-forge start` and will open the application window. Changes in the `src/main` or `src/renderer` directories will typically trigger a reload.

## Building the Application

To build a distributable version of the application for your current platform:

1.  **Ensure Dependencies are Installed**:
    If you haven't already, run:

    ```bash
    yarn install
    ```

2.  **Run the Build Command**:

    ```bash
    yarn run make
    ```

    This command uses `electron-forge make` to package the application.

3.  **Locate the Build Output**:
    The built application will be located in the `out/make` directory. The specific file format depends on your operating system:
    - **Windows**: A `Setup.exe` file (Squirrel installer).
    - **macOS**: A `.dmg` file.
    - **Linux**: A `.zip` file (currently; `.deb` is planned).

## Testing

To run the test suite (using Vitest):

```bash
yarn test
```

This will execute tests for both the main and renderer processes.

## Code Formatting and Linting

The project uses Prettier for code formatting and ESLint for linting.

- **Check Formatting**:
  ```bash
  yarn prettier-check
  ```
- **Apply Formatting**:
  ```bash
  yarn prettier
  ```
- **Run Linter**:
  ```bash
  yarn lint
  ```

Refer to the [Coding Style]({% link documentation/development/coding-style.md %}) guide for more details on setting up your IDE for automatic formatting.
