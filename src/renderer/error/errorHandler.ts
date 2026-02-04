import { toast } from '@/components/ui/sonner';
import { DisplayableError } from './DisplayableError';

export function showError(error: unknown): void;
export function showError(message: string, error: unknown): void;
export function showError(...args: unknown[]): void {
  const toastOptions = {
    style: { backgroundColor: 'var(--error)', color: 'var(--text-primary)' },
  };

  const error = args[args.length - 1];
  let message: string | undefined;

  if (error instanceof DisplayableError) {
    message = error.description || 'An error occurred';
  } else if (args.length === 2) {
    message = args[0] as string;
  } else {
    message = 'An unexpected error occurred';
  }

  toast.error(message, toastOptions);
  console.error(error);
}
