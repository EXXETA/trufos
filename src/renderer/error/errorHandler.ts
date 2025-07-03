import { toast } from 'sonner';
import { DisplayableError } from './DisplayableError';

export function handleError(error: unknown) {
  if (error instanceof DisplayableError) {
    toast.error(error.description || 'An error occurred');
    console.error(error);
  } else {
    toast.error('An unexpected error occurred');
    console.error(error);
  }
}
