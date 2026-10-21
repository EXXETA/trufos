import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TrufosHeader } from 'shim/objects/headers';
import { Table, TableBody } from '@/components/ui/table';
import { HeaderRow } from './HeaderRow';

const renderRow = (header: TrufosHeader) =>
  render(
    <Table>
      <TableBody>
        <HeaderRow
          header={header}
          index={0}
          handleUpdateHeader={vi.fn()}
          handleDeleteHeader={vi.fn()}
        />
      </TableBody>
    </Table>
  );

describe('HeaderRow', () => {
  it.each<TrufosHeader>([
    { key: '', value: '', isActive: true },
    { key: 'Content-Type', value: 'application/json', isActive: true },
    { key: 'My Header', value: 'x', isActive: false },
  ])('does not mark %o as invalid', (header) => {
    renderRow(header);

    expect(screen.getByRole('textbox', { name: 'Header key' }).getAttribute('aria-invalid')).toBe(
      'false'
    );
  });

  it('marks an active header with a value but no key as invalid', () => {
    renderRow({ key: '', value: 'Bearer abc', isActive: true });

    const input = screen.getByRole('textbox', { name: 'Header key' });
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('title')).toBe('Header key is required, header will not be sent');
  });

  it('marks an active header with an invalid key as invalid', () => {
    renderRow({ key: 'My Header', value: 'x', isActive: true });

    const input = screen.getByRole('textbox', { name: 'Header key' });
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('title')).toBe('Header key contains invalid characters');
  });
});
