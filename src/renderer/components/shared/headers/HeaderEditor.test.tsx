import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TrufosHeader } from 'shim/objects/headers';
import { makeAutomaticHeader, makeInheritedHeader } from 'shim/__mocks__/collection-fixtures';
import { AutomaticHeaderKey } from 'shim/collection-model';
import { HeaderEditor } from './HeaderEditor';

describe('HeaderEditor', () => {
  const onChange = vi.fn<(change: (headers: TrufosHeader[]) => TrufosHeader[]) => void>();

  /** Applies the change the editor made last to the given headers. */
  const applyLastChange = (headers: TrufosHeader[]) => onChange.mock.lastCall![0](headers);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('selects all headers with a single change', () => {
    // Arrange
    const headers = [
      { key: 'A', value: '1', isActive: false },
      { key: 'B', value: '2', isActive: true },
    ];
    render(<HeaderEditor headers={headers} onChange={onChange} />);

    // Act
    fireEvent.click(screen.getByText('Select All'));

    // Assert
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(applyLastChange(headers).map(({ isActive }) => isActive)).toEqual([true, true]);
  });

  it('deselects all headers when all are selected', () => {
    // Arrange
    const headers = [
      { key: 'A', value: '1', isActive: true },
      { key: 'B', value: '2', isActive: true },
    ];
    render(<HeaderEditor headers={headers} onChange={onChange} />);

    // Act
    fireEvent.click(screen.getByText('Select All'));

    // Assert
    expect(applyLastChange(headers).map(({ isActive }) => isActive)).toEqual([false, false]);
  });

  it('deletes the selected headers with a single change', () => {
    // Arrange
    const headers = [
      { key: 'Keep', value: 'this', isActive: false },
      { key: 'Delete', value: 'this', isActive: true },
      { key: 'Also-Delete', value: 'this', isActive: true },
    ];
    render(<HeaderEditor headers={headers} onChange={onChange} />);

    // Act
    fireEvent.click(screen.getByText('Delete Selected'));

    // Assert
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(applyLastChange(headers)).toEqual([headers[0]]);
  });

  it('adds, updates and deletes single headers without modifying the given ones', () => {
    // Arrange
    const headers = Object.freeze([Object.freeze({ key: 'A', value: '1', isActive: true })]);
    render(<HeaderEditor headers={headers as TrufosHeader[]} onChange={onChange} />);

    // Act & Assert
    fireEvent.click(screen.getByText('Add Header'));
    expect(applyLastChange([...headers])).toEqual([
      ...headers,
      { key: '', value: '', isActive: true },
    ]);

    fireEvent.change(screen.getByRole('textbox', { name: 'Header key' }), {
      target: { value: 'B' },
    });
    expect(applyLastChange([...headers])).toEqual([{ key: 'B', value: '1', isActive: true }]);

    fireEvent.click(screen.getByRole('button', { name: '' }));
    expect(applyLastChange([...headers])).toEqual([]);
  });

  it('shows the inherited headers read-only before the own ones', () => {
    // Arrange
    const inherited = [
      makeInheritedHeader('X-Tenant', 'acme'),
      makeInheritedHeader('x-own', 'collection', { isOverridden: true }),
    ];

    // Act
    render(
      <HeaderEditor
        headers={[{ key: 'X-Own', value: 'request', isActive: true }]}
        onChange={onChange}
        derived={{ inherited, onEnabledChange: vi.fn() }}
      />
    );

    // Assert
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows).toHaveLength(3);
    expect(within(rows[0]).getByText('X-Tenant').className).not.toContain('line-through');
    expect(within(rows[0]).queryByRole('textbox')).toBeNull();
    expect(within(rows[1]).getByText('x-own').className).toContain('line-through');
    expect(screen.getAllByText('from Collection')).toHaveLength(2);
    expect(within(rows[2]).getByDisplayValue('X-Own')).toBeTruthy();
  });

  it('does not include inherited headers in Select All', () => {
    // Arrange
    const headers = [{ key: 'X-Own', value: 'request', isActive: false }];
    const onEnabledChange = vi.fn();
    render(
      <HeaderEditor
        headers={headers}
        onChange={onChange}
        derived={{ inherited: [makeInheritedHeader('X-Tenant', 'acme')], onEnabledChange }}
      />
    );

    // Act
    fireEvent.click(screen.getByText('Select All'));

    // Assert
    expect(applyLastChange(headers)).toEqual([{ ...headers[0], isActive: true }]);
    expect(onEnabledChange).not.toHaveBeenCalled();
  });

  it('enables and disables inherited headers', () => {
    // Arrange
    const onEnabledChange = vi.fn();
    render(
      <HeaderEditor
        headers={[]}
        onChange={onChange}
        derived={{
          inherited: [
            makeInheritedHeader('X-Tenant', 'acme'),
            makeInheritedHeader('X-Trace', '1', { isDisabled: true }),
          ],
          onEnabledChange,
        }}
      />
    );

    // Act
    fireEvent.click(screen.getByRole('checkbox', { name: 'Send header X-Tenant' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Send header X-Trace' }));

    // Assert
    expect(onEnabledChange).toHaveBeenNthCalledWith(1, 'X-Tenant', false);
    expect(onEnabledChange).toHaveBeenNthCalledWith(2, 'X-Trace', true);
  });

  it('cannot disable inherited headers without a callback', () => {
    // Act
    render(
      <HeaderEditor
        headers={[]}
        onChange={onChange}
        derived={{ inherited: [makeInheritedHeader('X-Tenant', 'acme')] }}
      />
    );

    // Assert
    expect(screen.getByText('X-Tenant')).toBeTruthy();
    expect(screen.queryByRole('checkbox', { name: /send header/i })).toBeNull();
  });

  it('shows the automatic headers first, with a description of values known only when sent', () => {
    // Act
    render(
      <HeaderEditor
        headers={[]}
        onChange={onChange}
        derived={{
          automatic: [
            makeAutomaticHeader(AutomaticHeaderKey.CONTENT_TYPE, 'application/json'),
            makeAutomaticHeader(AutomaticHeaderKey.AUTHORIZATION, undefined, { canDisable: false }),
          ],
          inherited: [makeInheritedHeader('X-Tenant', 'acme')],
          onEnabledChange: vi.fn(),
        }}
      />
    );

    // Assert
    const rows = screen.getAllByRole('row').slice(1);
    expect(within(rows[0]).getByText('Content-Type')).toBeTruthy();
    expect(within(rows[0]).getByText('application/json')).toBeTruthy();
    expect(within(rows[1]).getByText('generated when sent').className).toContain('italic');
    expect(within(rows[2]).getByText('X-Tenant')).toBeTruthy();
  });

  it('only offers to disable the automatic headers that allow it, by their key', () => {
    // Arrange
    const onEnabledChange = vi.fn();
    render(
      <HeaderEditor
        headers={[]}
        onChange={onChange}
        derived={{
          automatic: [
            makeAutomaticHeader(AutomaticHeaderKey.USER_AGENT, 'Trufos/1.0.0'),
            makeAutomaticHeader(AutomaticHeaderKey.CONTENT_LENGTH, '42', { canDisable: false }),
          ],
          inherited: [],
          onEnabledChange,
        }}
      />
    );

    // Act
    fireEvent.click(screen.getByRole('checkbox', { name: 'Send header User-Agent' }));

    // Assert
    expect(screen.queryByRole('checkbox', { name: 'Send header Content-Length' })).toBeNull();
    expect(onEnabledChange).toHaveBeenCalledExactlyOnceWith(AutomaticHeaderKey.USER_AGENT, false);
  });

  it('says when an automatic header is only sent with a body, and describes pending values', () => {
    // Act
    render(
      <HeaderEditor
        headers={[]}
        onChange={onChange}
        derived={{
          automatic: [
            makeAutomaticHeader(AutomaticHeaderKey.CONTENT_TYPE, 'text/plain', {
              isConditional: true,
            }),
            makeAutomaticHeader(AutomaticHeaderKey.USER_AGENT),
          ],
          inherited: [],
        }}
      />
    );

    // Assert
    const rows = screen.getAllByRole('row').slice(1);
    expect(within(rows[0]).getByText('text/plain')).toBeTruthy();
    expect(within(rows[0]).getByText('only if the body is not empty')).toBeTruthy();
    expect(within(rows[1]).getByText('Trufos/<version>').className).toContain('italic');
    expect(within(rows[1]).getByText('set when sent')).toBeTruthy();
  });
});
