import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Checkbox } from './checkbox';

describe('Checkbox', () => {
  it('calls onCheckedChange with the new checked state', async () => {
    const onCheckedChange = vi.fn();
    const { getByRole } = render(<Checkbox checked={false} onCheckedChange={onCheckedChange} />);
    await userEvent.setup().click(getByRole('checkbox'));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it('exposes the aria-label as accessible name', () => {
    const { getByRole } = render(<Checkbox checked={false} aria-label="Secret" />);
    expect(getByRole('checkbox', { name: 'Secret' })).toBeTruthy();
  });

  it('shows the check icon only when checked', () => {
    const { container, rerender } = render(<Checkbox checked={false} />);
    expect(container.querySelector('svg')).toBeNull();
    rerender(<Checkbox checked />);
    expect(container.querySelector('svg')).not.toBeNull();
  });
});
