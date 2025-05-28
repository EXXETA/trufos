---
title: UI Components
nav_order: 6
has_children: true
---

# UI Components

Trufos's user interface is built with React and TypeScript, styled using Tailwind CSS. It leverages a combination of core UI elements provided by [ShadCN UI](https://ui.shadcn.com/) and custom application-specific components.

## ShadCN UI

ShadCN UI is not a component library in the traditional sense, but rather a collection of re-usable components that you can copy and paste into your apps and customize to your needs. Trufos uses several of these components as a base.

*   **Configuration**: `components.json` defines the setup for ShadCN UI, including style, Tailwind configuration path, and aliases.
    ```json
    {
      "$schema": "https://ui.shadcn.com/schema.json",
      "style": "default",
      "rsc": false,
      "tsx": true,
      "tailwind": {
        "config": "tailwind.config.js",
        "css": "src/renderer/styles/tailwind.css",
        "baseColor": "gray",
        "cssVariables": true,
        "prefix": ""
      },
      "aliases": {
        "components": "@/components", // Points to src/renderer/components
        "utils": "@/lib/utils"      // Points to src/renderer/lib/utils.ts
      }
    }
    ```
*   **Location**: The base ShadCN UI components are typically located in `src/renderer/components/ui/`.

## Component Structure

*   **Core UI Elements (`src/renderer/components/ui/`)**:
    These are often derived from or are direct implementations of ShadCN UI components. They provide the basic building blocks for the interface.
    See [Core UI Elements]({% link documentation/ui-components/core-elements.md %}) for details.

*   **Application-Specific Components**:
    These are custom components built for Trufos's specific needs, often composing core UI elements or implementing unique functionality. They are found in directories like:
    *   `src/renderer/components/mainWindow/`
    *   `src/renderer/components/sidebar/`
    *   `src/renderer/components/shared/`
    See [Application Components]({% link documentation/ui-components/application-components.md %}) for details.

*   **Icons (`src/renderer/components/icons/`)**:
    *   `Icon.tsx`: A base SVG icon wrapper component.
    *   `index.tsx`: Exports various SVG icons wrapped as React components using the `svgToIcon` higher-order component. This allows for consistent sizing and styling of icons.

This section provides an overview of these component categories. 