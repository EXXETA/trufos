import * as React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';

import { CheckedIcon } from '@/components/icons';
import { cn } from '@/lib/utils';

const Checkbox = React.forwardRef<
  React.ComponentRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      'peer border-text-primary ring-offset-background focus-visible:ring-ring data-[state=checked]:border-accent-primary data-[state=checked]:bg-accent-tertiary relative h-4 w-4 shrink-0 cursor-pointer rounded-[2px] border bg-transparent focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:cursor-not-allowed disabled:opacity-50',
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className="pointer-events-none absolute inset-0 flex rotate-6 items-center justify-center">
      <CheckedIcon size={16} viewBox="0 0 16 16" color="var(--accent-primary)" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
