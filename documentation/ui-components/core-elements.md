---
title: Core UI Elements
nav_order: 1
parent: UI Components
---

# Core UI Elements

Trufos utilizes a set of core UI elements, primarily sourced from or inspired by [ShadCN UI](https://ui.shadcn.com/). These components are foundational building blocks for the application's interface and are generally located in `src/renderer/components/ui/`.

They are built with Radix UI primitives and styled with Tailwind CSS, ensuring accessibility and consistency.

## Key Core Components

Below is a list of notable core UI components used in Trufos:

*   **`Button` (`button.tsx`)**:
    *   Standard button component with various styles (variants: `default`, `destructive`, `outline`, `secondary`, `ghost`, `link`) and sizes.
    *   Built using `cva` (class-variance-authority) for managing variants.
    *   Supports `asChild` prop for polymorphism with Radix UI Slot.

*   **`Card` (`card.tsx`)**:
    *   Container component for grouping related content.
    *   Includes sub-components: `CardHeader`, `CardFooter`, `CardTitle`, `CardDescription`, `CardContent`.

*   **`Dialog` (`dialog.tsx`)**:
    *   Modal dialog component for displaying information or requiring user input.
    *   Built on `DialogPrimitive` from Radix UI.
    *   Includes: `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogFooter`, `DialogTitle`, `DialogDescription`, `DialogClose`.

*   **`DropdownMenu` (`dropdown-menu.tsx`)**:
    *   Context menu or dropdown list component.
    *   Built on `DropdownMenuPrimitive` from Radix UI.
    *   Supports sub-menus, radio groups, checkbox items, labels, and separators.
    *   Includes: `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuCheckboxItem`, `DropdownMenuRadioItem`, `DropdownMenuLabel`, `DropdownMenuSeparator`, `DropdownMenuShortcut`, `DropdownMenuGroup`, `DropdownMenuSub`, `DropdownMenuSubContent`, `DropdownMenuSubTrigger`.

*   **`Input` (`input.tsx`)**:
    *   Standard text input field.
    *   Styled with a rounded-full appearance and focus effects.

*   **`Select` (`select.tsx`)**:
    *   Dropdown select component for choosing an option from a list.
    *   Built on `SelectPrimitive` from Radix UI.
    *   Customized trigger with an animated `SmallArrow` icon.
    *   Includes: `SelectTrigger`, `SelectContent`, `SelectGroup`, `SelectItem`, `SelectLabel`, `SelectValue`, `SelectSeparator`, `SelectScrollUpButton`, `SelectScrollDownButton`.

*   **`Separator` (`separator.tsx`)**:
    *   A horizontal or vertical dividing line.
    *   Built on `SeparatorPrimitive` from Radix UI.

*   **`Skeleton` (`skeleton.tsx`)**:
    *   Placeholder component used to indicate loading content.
    *   Features a pulse animation.

*   **`Table` (`table.tsx`)**:
    *   Component for displaying tabular data.
    *   Includes: `TableHeader`, `TableBody`, `TableFooter`, `TableHead`, `TableRow`, `TableCell`, `TableCaption`.
    *   Styled with borders and hover effects.

*   **`Tabs` (`tabs.tsx`)**:
    *   Component for organizing content into switchable tabbed sections.
    *   Built on `TabsPrimitive` from Radix UI.
    *   Includes: `TabsList`, `TabsTrigger`, `TabsContent`.
    *   Custom styling for triggers and content area with scrollbar.

*   **`Toast` (`toast.tsx`) & `Toaster` (`toaster.tsx`) & `useToast` (`use-toast.ts`)**:
    *   System for displaying short, non-intrusive notifications (toasts).
    *   Built on `ToastPrimitives` from Radix UI.
    *   `useToast` hook provides a programmatic way to trigger toasts, manage their state (inspired by `react-hot-toast`).
    *   `Toaster` component renders the toasts in a `ToastViewport`.
    *   Supports variants (e.g., `default`, `destructive`).

*   **`Tooltip` (`tooltip.tsx`)**:
    *   Displays informational text when hovering over an element.
    *   Built on `TooltipPrimitive` from Radix UI.
    *   Includes: `TooltipProvider`, `TooltipTrigger`, `TooltipContent`.

*   **`Collapsible` (`collapsible.tsx`)**:
    *   Component for creating elements that can expand and collapse their content.
    *   Built on `CollapsiblePrimitive` from Radix UI.
    *   Used in the sidebar for folder navigation.

*   **`Sidebar` (`sidebar.tsx`)**:
    *   A comprehensive and highly customizable sidebar component system, likely adapted or inspired by a third-party solution, designed for flexible sidebar layouts.
    *   **Context-based**: Uses `SidebarProvider` and `useSidebar` hook to manage state (open/collapsed).
    *   **Layout Components**: `Sidebar`, `SidebarInset`, `SidebarRail`.
    *   **Structural Components**: `SidebarHeader`, `SidebarContent`, `SidebarFooter`, `SidebarSeparator`.
    *   **Group & Menu Components**: `SidebarGroup`, `SidebarGroupLabel`, `SidebarGroupAction`, `SidebarGroupContent`, `SidebarMenu`, `SidebarMenuItem`, `SidebarMenuButton`, `SidebarMenuAction`, `SidebarMenuBadge`, `SidebarMenuSkeleton`, `SidebarMenuSub`, `SidebarMenuSubItem`, `SidebarMenuSubButton`.
    *   Supports different variants (`sidebar`, `floating`, `inset`) and collapsible behaviors (`offcanvas`, `icon`).
    *   Handles state persistence via cookies (`SIDEBAR_COOKIE_NAME`).
    *   Includes keyboard shortcut (`Ctrl/Cmd + B`) for toggling.

These components form the visual and interactive language of Trufos. When developing new UI features, developers should first look to utilize or extend these existing core elements to maintain consistency. 