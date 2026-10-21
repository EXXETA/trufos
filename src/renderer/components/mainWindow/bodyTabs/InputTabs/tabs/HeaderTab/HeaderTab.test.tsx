import { fireEvent, render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { TrufosHeader } from 'shim/objects/headers';
import { AutomaticHeader, AutomaticHeaderKey, InheritedHeader } from 'shim/collection-model';
import { makeAutomaticHeader, makeInheritedHeader } from 'shim/__mocks__/collection-fixtures';
import { HeaderTab } from './HeaderTab';

const { actions, selected } = vi.hoisted(() => ({
  actions: { editHeaders: vi.fn(), setHeaderEnabled: vi.fn() },
  selected: {
    headers: [] as TrufosHeader[],
    inherited: [] as InheritedHeader[],
    automatic: [] as AutomaticHeader[],
  },
}));

vi.mock('@/state/collectionStore', () => ({
  useCollectionActions: () => actions,
  useSelectedRequestHeaders: () => selected,
}));

describe('HeaderTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selected.headers = [];
    selected.inherited = [];
    selected.automatic = [];
  });

  it('edits the headers of the selected request', () => {
    // Arrange
    selected.headers = [{ key: 'A', value: '1', isActive: false }];
    render(<HeaderTab />);

    // Act
    fireEvent.click(screen.getByText('Select All'));

    // Assert
    expect(actions.editHeaders).toHaveBeenCalledTimes(1);
  });

  it('shows the headers the request inherits and toggles them', () => {
    // Arrange
    selected.headers = [{ key: 'X-Own', value: 'request', isActive: true }];
    selected.inherited = [makeInheritedHeader('X-Tenant', 'acme')];
    render(<HeaderTab />);

    // Act
    fireEvent.click(screen.getByRole('checkbox', { name: 'Send header X-Tenant' }));

    // Assert
    expect(actions.setHeaderEnabled).toHaveBeenCalledExactlyOnceWith('X-Tenant', false);
  });

  it('shows the automatic headers of the request and toggles them', () => {
    // Arrange
    selected.automatic = [makeAutomaticHeader(AutomaticHeaderKey.USER_AGENT, 'Trufos/1.0.0')];
    render(<HeaderTab />);

    // Act
    fireEvent.click(screen.getByRole('checkbox', { name: 'Send header User-Agent' }));

    // Assert
    expect(actions.setHeaderEnabled).toHaveBeenCalledExactlyOnceWith(
      AutomaticHeaderKey.USER_AGENT,
      false
    );
  });
});
