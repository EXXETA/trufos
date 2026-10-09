import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Button } from './button';

describe('Button', () => {
  it('uses the library disabled look for a disabled default button', () => {
    render(<Button disabled>Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button.className).toContain('disabled:bg-accent-disabled');
    expect(button.className).toContain('disabled:text-text-disabled');
    expect(button.className).toContain('disabled:opacity-100');
    expect(button.className).not.toContain('disabled:opacity-40');
  });

  it('keeps the enabled default look', () => {
    render(<Button>Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button.className).toContain('bg-accent-primary');
    expect(button.className).toContain('text-accent-tertiary');
  });

  it('keeps the danger colours while a destructive button is pressed', () => {
    render(<Button variant="destructive">Close</Button>);
    const button = screen.getByRole('button', { name: 'Close' });
    expect(button.className).toContain('bg-danger/10');
    expect(button.className).toContain('active:bg-danger');
    expect(button.className).not.toContain('active:bg-accent-secondary');
  });

  it('keeps the pill shape for small buttons', () => {
    render(<Button size="sm">Add</Button>);
    const button = screen.getByRole('button', { name: 'Add' });
    expect(button.className).toContain('rounded-full');
    expect(button.className).not.toContain('rounded-md');
  });
});
