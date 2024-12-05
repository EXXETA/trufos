import * as React from 'react';

import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-10 w-full border-2 border-divider rounded-full' +
            ' focus-visible:outline-none focus-visible:ring-none' +
            ' focus:border-accent-secondary focus-visible:border-accent-secondary' +
            ' bg-background px-3 py-2 text-sm placeholder:text-muted-foreground' +
            ' disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
