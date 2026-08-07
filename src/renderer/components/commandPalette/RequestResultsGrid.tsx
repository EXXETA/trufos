import * as React from 'react';
import { cn } from '@/lib/utils';
import { CommandGroup, CommandItem } from '@/components/ui/command';

/**
 * 2-column grid ancestor for a block of request rows: column 1 (method badge) auto-sizes to the
 * widest method text across every subgridded row inside it.
 */
export const RequestResultsGrid = ({ children }: { children: React.ReactNode }) => (
  <div className="grid grid-cols-[auto_1fr]">{children}</div>
);

interface RequestCommandGroupProps {
  heading?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * `CommandGroup` wrapper that passes the 2 grid tracks down through cmdk's fixed
 * group/heading/items DOM so every request row's columns line up. Must be rendered inside a
 * `RequestResultsGrid`.
 */
export const RequestCommandGroup = ({ heading, children }: RequestCommandGroupProps) => (
  <CommandGroup
    heading={heading}
    className="col-span-full grid grid-cols-subgrid **:[[cmdk-group-heading]]:col-span-full **:[[cmdk-group-items]]:col-span-full **:[[cmdk-group-items]]:grid **:[[cmdk-group-items]]:grid-cols-subgrid"
  >
    {children}
  </CommandGroup>
);

/**
 * `CommandItem` wrapper for a single request row: joins the row into the ancestor subgrid and
 * applies the shared hover/keyboard-selection highlight. Must be rendered inside a
 * `RequestCommandGroup`.
 */
export const RequestCommandItem = React.forwardRef<
  React.ComponentRef<typeof CommandItem>,
  React.ComponentPropsWithoutRef<typeof CommandItem>
>(({ className, ...props }, ref) => (
  <CommandItem
    ref={ref}
    className={cn(
      "data-[selected='true']:bg-divider col-span-full grid grid-cols-subgrid",
      className
    )}
    {...props}
  />
));
RequestCommandItem.displayName = 'RequestCommandItem';
