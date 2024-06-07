import { cn } from '../../lib/utils';

interface DividerComponentProps {
  orientation?: 'horizontal' | 'vertical'
  className?: string
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
export const Divider = ({orientation= 'horizontal', className}: DividerComponentProps) => {
  return (
    <div className={ className + cn(`${orientation === 'horizontal' ? 'h-0' : 'h-full'} ${orientation === 'horizontal' ? 'w-full' : 'w-0'} ${orientation === 'horizontal' ? 'border-t' : 'bprder-r'}`)} />
  )
}
