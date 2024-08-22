import { cn } from '@/lib/utils';

interface DividerComponentProps {
  orientation?: 'horizontal' | 'vertical'
  className?: string
}

export const Divider = ({orientation= 'horizontal', className}: DividerComponentProps) => {
  return (
    <div className={ cn(`${orientation === 'horizontal' ? 'w-full' : 'h-full'} ${orientation === 'horizontal' ? 'border-t' : 'border-r'} ${className}`) } />
  )
}
