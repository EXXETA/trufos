import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Button } from './button';

describe('Button', () => {
  it('uses the library disabled look for a disabled default button', () => {
    render(<Button disabled>Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button.className).toContain('bg-accent-disabled');
    expect(button.className).toContain('text-text-disabled');
    expect(button.className).toContain('disabled:opacity-100');
    expect(button.className).not.toContain('disabled:opacity-40');
    expect(button.className.split(' ')).not.toContain('border');
    expect(button.className).not.toContain('hover:bg-accent-primary/90');
  });

  it('keeps the enabled default look', () => {
    render(<Button>Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button.className).toContain('bg-accent-primary');
    expect(button.className).toContain('text-accent-tertiary');
    expect(button.className).not.toContain('bg-accent-disabled');
  });
});
