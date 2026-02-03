import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';

import { cn } from '@/lib/utils';

const Tabs = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Root
    ref={ref}
    className={cn('bg-background flex flex-col rounded-md', className)}
    {...props}
  />
));
Tabs.displayName = TabsPrimitive.Root.displayName;

const TabsList = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn('bg-background text-muted-foreground h-10 rounded-md rounded-b-none', className)}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'cursor-pointer',
      'inline-flex h-[36px] items-center justify-center rounded-[24px] whitespace-nowrap',
      'px-3 py-1.5',
      'ring-offset-background text-sm font-medium transition-all focus-visible:outline-hidden',
      'focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2',
      'disabled:pointer-events-none disabled:opacity-50',
      'hover:outline-solid',
      'hover:outline-2',
      'hover:outline-accent-primary',
      'data-[state=active]:bg-accent-tertiary data-[state=active]:text-accent-primary',
      'data-[state=active]:font-bold data-[state=active]:shadow-xs',
      'data-[state=active]:active:outline-solid',
      'data-[state=active]:active:outline-2',
      'data-[state=active]:active:outline-accent-secondary',
      'data-[state=active]:active:text-accent-secondary',
      className
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      `tabs-scrollbar bg-card ring-offset-background focus-visible:ring-ring mt-2 flex-1 overflow-y-auto rounded-[24px] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden`,
      className
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
