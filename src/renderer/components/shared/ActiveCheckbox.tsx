import { CheckedIcon } from '@/components/icons';
import { cn } from '@/lib/utils';

type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Accessible name for the checkbox */
  'aria-label'?: string;
};

export const ActiveCheckbox = ({ checked, onChange, 'aria-label': ariaLabel }: Props) => (
  <div className="relative z-10 h-4 w-4 cursor-pointer">
    <input
      type="checkbox"
      checked={checked}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.checked)}
      className={cn('form-checkbox h-4 w-4 cursor-pointer appearance-none rounded-[2px] border', {
        'border-accent-primary bg-accent-tertiary': checked,
        'border-text-primary bg-transparent': !checked,
      })}
    />
    {checked && (
      <div className="pointer-events-none absolute inset-0 flex rotate-6 items-center justify-center">
        <CheckedIcon size={16} viewBox="0 0 16 16" color="var(--accent-primary)" />
      </div>
    )}
  </div>
);
