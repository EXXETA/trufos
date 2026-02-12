import { render, fireEvent, cleanup } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { HeaderTab } from './HeaderTab';

const addHeaderMock = vi.fn();
const deleteHeaderMock = vi.fn();
const updateHeaderMock = vi.fn();
const setDraftFlagMock = vi.fn();

let mockHeaders: any[] = [];

vi.mock('@/state/collectionStore', () => ({
  useCollectionActions: () => ({
    addHeader: addHeaderMock,
    deleteHeader: deleteHeaderMock,
    updateHeader: updateHeaderMock,
    setDraftFlag: setDraftFlagMock,
  }),
  useCollectionStore: (selector) =>
    selector({
      selectedRequestId: 'req-1',
      requests: new Map([['req-1', { id: 'req-1', headers: mockHeaders }]]),
    }),
  selectRequest: (state) => state.requests.get(state.selectedRequestId),
}));

describe('HeaderTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('should select all headers when Select All is clicked', () => {
    // Arrange
    mockHeaders = [
      { key: 'Content-Type', value: 'application/json', isActive: false },
      { key: 'Authorization', value: 'Bearer token', isActive: false },
      { key: 'Accept', value: 'json', isActive: true },
    ];
    const { getByText } = render(<HeaderTab />);

    // Act
    fireEvent.click(getByText('Select All'));

    // Assert
    expect(updateHeaderMock).toHaveBeenCalledTimes(3);
    expect(updateHeaderMock).toHaveBeenCalledWith(0, { isActive: true });
    expect(updateHeaderMock).toHaveBeenCalledWith(1, { isActive: true });
    expect(updateHeaderMock).toHaveBeenCalledWith(2, { isActive: true });
    expect(setDraftFlagMock).toHaveBeenCalled();
  });

  it('should deselect all headers when all are already selected', () => {
    // Arrange
    mockHeaders = [
      { key: 'Content-Type', value: 'application/json', isActive: true },
      { key: 'Authorization', value: 'Bearer token', isActive: true },
    ];
    const { getByText } = render(<HeaderTab />);

    // Act
    fireEvent.click(getByText('Select All'));

    // Assert
    expect(updateHeaderMock).toHaveBeenCalledTimes(2);
    expect(updateHeaderMock).toHaveBeenCalledWith(0, { isActive: false });
    expect(updateHeaderMock).toHaveBeenCalledWith(1, { isActive: false });
    expect(setDraftFlagMock).toHaveBeenCalled();
  });

  it('should only delete active headers when Delete Selected is clicked', () => {
    // Arrange
    mockHeaders = [
      { key: 'Keep', value: 'this', isActive: false },
      { key: 'Delete', value: 'this', isActive: true },
      { key: 'Also-Delete', value: 'this', isActive: true },
    ];
    const { getByText } = render(<HeaderTab />);

    // Act
    fireEvent.click(getByText('Delete Selected'));

    // Assert: deleted from back to front to keep indices stable
    expect(deleteHeaderMock).toHaveBeenCalledTimes(2);
    expect(deleteHeaderMock).toHaveBeenCalledWith(2);
    expect(deleteHeaderMock).toHaveBeenCalledWith(1);
    expect(setDraftFlagMock).toHaveBeenCalled();
  });

  it('should not delete anything when no headers are selected', () => {
    // Arrange
    mockHeaders = [{ key: 'Keep', value: 'this', isActive: false }];
    const { getByText } = render(<HeaderTab />);

    // Act
    fireEvent.click(getByText('Delete Selected'));

    // Assert
    expect(deleteHeaderMock).not.toHaveBeenCalled();
  });
});
