import {
  forwardRef,
  useRef,
  useState,
  useEffect,
  useImperativeHandle,
  HTMLAttributes,
  ReactNode,
} from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface TypographyLineClampProps extends HTMLAttributes<HTMLDivElement> {
  placement?: 'top' | 'right' | 'bottom' | 'left';
  showTool?: boolean;
  lineClamp?: number;
  contentClassname?: string;
  children: ReactNode;
}

export const TypographyLineClamp = forwardRef<HTMLDivElement, TypographyLineClampProps>(
  (
    {
      placement = 'top',
      showTool = false,
      lineClamp = 1,
      contentClassname = '',
      children,
      ...otherProps
    },
    ref
  ) => {
    const contentRef = useRef<HTMLDivElement>(null);
    const [isContentOverflow, setIsContentOverflow] = useState(false);

    const checkOverflow = () => {
      if (contentRef.current) {
        const el = contentRef.current;
        const isOverflow = el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight;
        setIsContentOverflow(isOverflow);
      }
    };

    useEffect(() => {
      checkOverflow();
    }, [children]);

    useEffect(() => {
      const observer = new ResizeObserver(() => checkOverflow());
      if (contentRef.current) observer.observe(contentRef.current);
      return () => observer.disconnect();
    }, []);

    useImperativeHandle(ref, () => contentRef.current);

    const contentClasses = [
      'relative overflow-hidden break-words',
      lineClamp === 1 ? 'truncate' : `line-clamp-${lineClamp}`,
    ].join(' ');

    const contentElement = (
      <div ref={contentRef} className={cn(`${contentClasses} ${contentClassname}`)} {...otherProps}>
        {children}
      </div>
    );

    if (showTool && isContentOverflow) {
      return (
        <TooltipProvider>
          <Tooltip delayDuration={150}>
            <TooltipTrigger asChild>{contentElement}</TooltipTrigger>

            <TooltipContent side={placement}>
              <p className="max-w-xs text-sm text-muted-foreground">{children}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return contentElement;
  }
);
