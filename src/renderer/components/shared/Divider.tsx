import { cn } from '@/lib/utils';

interface DividerComponentProps {
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}

/**
 * Simple and versatile divider component.
 *
 * ### Props definition
 * - orientation `'horizontal' | 'vertical'`
 *
 * ### How to use
 * - Import where required
 * - Set orientation prop for desired output. Default `horizontal`
 * */
export const Divider = ({ orientation = 'horizontal', className }: DividerComponentProps) => {
  return (
    <div
      className={cn(
        `${orientation === 'horizontal' ? 'w-full' : 'h-full'} ${orientation === 'horizontal' ? 'border-t' : 'border-r'} ${className}`
      )}
    />
  );
};
