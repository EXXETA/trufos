import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  disabled?: boolean;
  width?: number | string;
  height?: number | string;
}

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, disabled = false, width = 24, height = 24, style, ...props }, ref) => (
    <Button
      ref={ref}
      variant="ghost"
      disabled={disabled}
      className={cn('p-0', disabled ? 'text-(--disabled)' : 'text-accent-primary', className)}
      style={{ width, height, ...style }}
      {...props}
    />
  )
);
IconButton.displayName = 'IconButton';

export { IconButton };
