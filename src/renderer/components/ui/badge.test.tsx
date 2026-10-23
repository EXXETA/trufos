import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Badge } from './badge';

describe('Badge', () => {
  it('is neutral by default', () => {
    render(<Badge>1.0.0</Badge>);
    const badge = screen.getByText('1.0.0');
    expect(badge.className).toContain('bg-muted');
    expect(badge.className).toContain('text-text-secondary');
  });

  it('tints itself with the colour of its variant', () => {
    render(<Badge variant="danger">Failed</Badge>);
    const badge = screen.getByText('Failed');
    expect(badge.className).toContain('bg-danger/10');
    expect(badge.className).toContain('text-danger');
    expect(badge.className).not.toContain('bg-muted');
  });

  it('merges extra classes', () => {
    render(<Badge className="tabular-nums">2</Badge>);
    expect(screen.getByText('2').className).toContain('tabular-nums');
  });
});
