import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Check, X } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export interface InlineRenameProps {
  initialValue: string;
  onSave: (newValue: string) => void;
  onCancel: () => void;
  validate?: (value: string) => boolean;
  className?: string;
  inputClassName?: string;
}

export const InlineRename = ({
  initialValue,
  onSave,
  onCancel,
  validate,
  className,
  inputClassName,
}: InlineRenameProps) => {
  const [value, setValue] = useState(initialValue);

  const handleSave = () => {
    if (!validate || validate(value)) {
      onSave(value);
    }
  };

  return (
    <>
      <div className={cn('min-w-0 flex-1', className)}>
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.stopPropagation();
              handleSave();
            } else if (e.key === 'Escape') {
              e.stopPropagation();
              onCancel();
            }
          }}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className={cn("bg-background focus-visible:ring-sidebar-ring h-8 w-full text-sm shadow-none focus-visible:ring-2", inputClassName)}
          autoFocus
        />
      </div>
      <div
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        className="flex items-center gap-1"
      >
        <Button
          onClick={handleSave}
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0"
          aria-label="Save"
          disabled={validate && !validate(value)}
        >
          <Check className="h-3 w-3" />
        </Button>
        <Button
          onClick={onCancel}
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0"
          aria-label="Cancel"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </>
  );
};
