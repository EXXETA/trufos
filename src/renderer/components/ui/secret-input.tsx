import { useState } from 'react';
import { Input } from './input';
import { cn } from '@/lib/utils';

interface SecretInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  secret?: boolean;
}

export function SecretInput({ secret = true, className, ...props }: SecretInputProps) {
  const [show, setShow] = useState(false);

  if (!secret) {
    return <Input type="text" className={className} {...props} />;
  }

  return (
    <div className="relative w-full">
      <Input type={show ? 'text' : 'password'} className={cn('pr-16', className)} {...props} />
      <button
        type="button"
        className="absolute inset-y-0 right-0 flex h-10 w-16 items-center justify-center text-sm text-text-secondary hover:text-text-primary"
        onClick={() => setShow((prev) => !prev)}
        tabIndex={-1}
      >
        {show ? 'Hide' : 'Show'}
      </button>
    </div>
  );
}
SecretInput.displayName = 'SecretInput';
