import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InlineRenameInputProps {
  initialValue: string;
  onSave: (newValue: string) => void;
  validate?: (value: string) => boolean;
  className?: string;
  onCancel?: () => void;
  autoEdit?: boolean;
}

export const InlineRenameInput = ({
  initialValue,
  onSave,
  validate = (v) => !!v.trim(),
  className,
  autoEdit = false,
  onCancel,
}: InlineRenameInputProps) => {
  const [editing, setEditing] = useState(autoEdit);
  const [value, setValue] = useState(initialValue);

  // Sync editing state whenever autoEdit becomes true
  useEffect(() => {
    if (autoEdit) setEditing(true);
  }, [autoEdit]);

  const handleSave = () => {
    if (validate(value) && value !== initialValue) {
      onSave(value.trim());
    }
    setEditing(false);
  };

  const handleCancel = () => {
    setValue(initialValue);
    setEditing(false);
    onCancel?.();
  };

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {editing ? (
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') handleCancel();
          }}
          autoFocus
          onFocus={(e) => e.target.select()}
          className="h-6 w-3/4 max-w-[120px] min-w-[70px] text-sm shadow-none focus-visible:ring-2"
        />
      ) : (
        <div onClick={() => setEditing(true)} className={cn('cursor-pointer truncate font-medium')}>
          {value}
        </div>
      )}

      {editing && (
        <div className="flex items-center gap-1">
          <Button onClick={handleSave} size="sm" variant="ghost" className="h-6 w-6 p-0">
            <Check className="h-3 w-3" />
          </Button>
          <Button onClick={handleCancel} size="sm" variant="ghost" className="h-6 w-6 p-0">
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
};
