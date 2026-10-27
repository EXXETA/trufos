import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { CircleAlert, TriangleAlert } from 'lucide-react';

import { cn } from '@/lib/utils';

const alertVariants = cva('flex items-start gap-2 rounded-md px-3 py-2 text-sm', {
  variants: {
    variant: {
      warning: 'bg-state-warning/10 text-state-warning',
      danger: 'bg-danger/10 text-danger',
    },
  },
  defaultVariants: {
    variant: 'warning',
  },
});

const ICONS = { warning: TriangleAlert, danger: CircleAlert };

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof alertVariants> {}

/**
 * A tinted box with an icon that draws attention to a warning or an error, see shadcn/ui. It is
 * announced as an alert; pass another `role`, e.g. `note`, for one that is always shown.
 */
function Alert({ className, variant, children, ...props }: AlertProps): React.JSX.Element {
  const Icon = ICONS[variant ?? 'warning'];
  return (
    <div role="alert" className={cn(alertVariants({ variant, className }))} {...props}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  );
}

export { Alert };
