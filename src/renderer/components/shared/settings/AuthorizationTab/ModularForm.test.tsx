import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ModularForm } from './ModularForm';

describe('ModularForm', () => {
  it('masks password fields but not text fields', () => {
    // Arrange
    render(
      <ModularForm
        config={{
          username: { type: 'text', label: 'Username' },
          password: { type: 'password', label: 'Password' },
        }}
        data={{ username: 'user', password: 'secret' }}
        onDataChanged={vi.fn()}
      />
    );

    // Assert
    expect(screen.getByDisplayValue<HTMLInputElement>('user').type).toBe('text');
    expect(screen.getByDisplayValue<HTMLInputElement>('secret').type).toBe('password');
    expect(screen.getByRole('button', { name: 'Show' })).toBeDefined();
  });
});
