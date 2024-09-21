import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';

import { cn } from '@/lib/utils';

const Tabs = React.forwardRef<React.ElementRef<typeof TabsPrimitive.Root>, React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root>>(({
  className,
  ...props
}, ref) => (<TabsPrimitive.Root
        ref={ref}
        className={cn('h-[calc(100vh-112px)] flex flex-col bg-background rounded-md', className)}
        {...props}
    />));
Tabs.displayName = TabsPrimitive.Root.displayName;

const TabsList = React.forwardRef<React.ElementRef<typeof TabsPrimitive.List>, React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>>(({
  className,
  ...props
}, ref) => (<TabsPrimitive.List
        ref={ref}
        className={cn('h-10 rounded-md rounded-b-none bg-background text-muted-foreground', className)}
        {...props}
    />));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<React.ElementRef<typeof TabsPrimitive.Trigger>, React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>>(({
  className,
  ...props
}, ref) => {

  return (<TabsPrimitive.Trigger
          ref={ref}
          className={cn('tabs-trigger', className)}
          {...props}
      />);
});
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<React.ElementRef<typeof TabsPrimitive.Content>, React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>>(({
  className,
  ...props
}, ref) => (<TabsPrimitive.Content
        ref={ref}
        className={cn(`overflow-y-auto rounded-[24px] bg-card flex-1 mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 tabs-scrollbar`, className)}
        {...props}
    />));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
