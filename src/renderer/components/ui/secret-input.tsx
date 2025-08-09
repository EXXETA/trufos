import { useState } from 'react';
import { cn } from '@/lib/utils';

interface SecretInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  secret?: boolean;
}

export function SecretInput({ secret = false, className, ...props }: SecretInputProps) {
  const [show, setShow] = useState(false);

  if (!secret) {
    return (
      <input
        type="text"
        className={cn('w-full bg-transparent outline-none', className)}
        {...props}
      />
    );
  }

  return (
    <div className="relative w-full">
      <input
        type={show ? 'text' : 'password'}
        className={cn('w-full bg-transparent pr-12 outline-none', className)}
        {...props}
      />
      <button
        type="button"
        className="absolute inset-y-0 right-0 flex items-center text-sm text-text-secondary hover:text-text-primary"
        onClick={() => setShow((prev) => !prev)}
        tabIndex={-1}
      >
        {show ? 'Hide' : 'Show'}
      </button>
    </div>
  );
}
