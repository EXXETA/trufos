import { fireEvent, render, screen } from '@testing-library/react';
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

  describe('field action', () => {
    const config = { issuer: { type: 'text', label: 'Issuer' } } as const;
    const getButton = () => screen.getByRole<HTMLButtonElement>('button', { name: 'Discover' });

    it('runs the action of the field on a click', () => {
      // Arrange
      const onClick = vi.fn();
      render(
        <ModularForm
          config={config}
          data={{ issuer: 'https://example.com' }}
          onDataChanged={vi.fn()}
          fieldActions={{ issuer: { label: 'Discover', onClick } }}
        />
      );

      // Act
      fireEvent.click(getButton());

      // Assert
      expect(onClick).toHaveBeenCalledOnce();
    });

    it('shows no button for an action of a field that is not in the form', () => {
      // Arrange & Act
      render(
        <ModularForm
          config={config}
          data={{ issuer: 'https://example.com' }}
          onDataChanged={vi.fn()}
          fieldActions={{ other: { label: 'Discover', onClick: vi.fn() } }}
        />
      );

      // Assert
      expect(screen.queryByRole('button', { name: 'Discover' })).toBeNull();
    });

    it('is disabled while the field is empty', () => {
      // Arrange & Act
      render(
        <ModularForm
          config={config}
          data={{ issuer: ' ' }}
          onDataChanged={vi.fn()}
          fieldActions={{ issuer: { label: 'Discover', onClick: vi.fn() } }}
        />
      );

      // Assert
      expect(getButton().disabled).toBe(true);
    });

    it('is disabled while the action is running', () => {
      // Arrange & Act
      render(
        <ModularForm
          config={config}
          data={{ issuer: 'https://example.com' }}
          onDataChanged={vi.fn()}
          fieldActions={{ issuer: { label: 'Discover', pending: true, onClick: vi.fn() } }}
        />
      );

      // Assert
      expect(getButton().disabled).toBe(true);
    });
  });
});
