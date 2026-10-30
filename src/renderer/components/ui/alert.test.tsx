import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Alert } from './alert';

describe('Alert', () => {
  it('is an announced warning by default', () => {
    render(<Alert>Careful</Alert>);
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toBe('Careful');
    expect(alert.className).toContain('bg-state-warning/10');
  });

  it('tints itself with the colour of its variant', () => {
    render(<Alert variant="danger">Failed</Alert>);
    expect(screen.getByRole('alert').className).toContain('bg-danger/10');
  });

  it('takes another role, e.g. for a warning that is always shown', () => {
    render(<Alert role="note">Always here</Alert>);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('note').textContent).toBe('Always here');
  });
});
