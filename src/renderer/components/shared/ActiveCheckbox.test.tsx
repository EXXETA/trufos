import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ActiveCheckbox } from './ActiveCheckbox';

describe('ActiveCheckbox', () => {
  it('calls onChange with the new checked state', async () => {
    const onChange = vi.fn();
    const { getByRole } = render(<ActiveCheckbox checked={false} onChange={onChange} />);
    await userEvent.setup().click(getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('exposes the aria-label as accessible name', () => {
    const { getByRole } = render(
      <ActiveCheckbox checked={false} aria-label="Secret" onChange={() => {}} />
    );
    expect(getByRole('checkbox', { name: 'Secret' })).toBeTruthy();
  });

  it('shows the check icon only when checked', () => {
    const { container, rerender } = render(<ActiveCheckbox checked={false} onChange={() => {}} />);
    expect(container.querySelector('svg')).toBeNull();
    rerender(<ActiveCheckbox checked onChange={() => {}} />);
    expect(container.querySelector('svg')).not.toBeNull();
  });
});
