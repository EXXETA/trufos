import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect } from 'vitest';
import { TrufosHeader } from 'shim/objects/headers';
import { TrufosQueryParam } from 'shim/objects/query-param';
import { InputTabs } from './InputTabs';

let mockHeaders: TrufosHeader[] = [];
let mockQueryParams: TrufosQueryParam[] = [];

// Mock child components to avoid their store dependencies
vi.mock('@/components/mainWindow/bodyTabs/InputTabs/tabs/HeaderTab/HeaderTab', () => ({
  HeaderTab: () => <div>HeaderTab Content</div>,
}));

vi.mock('@/components/mainWindow/bodyTabs/InputTabs/tabs/BodyTab', () => ({
  BodyTab: () => <div>BodyTab Content</div>,
}));

vi.mock('@/components/mainWindow/bodyTabs/InputTabs/tabs/ParamsTab', () => ({
  ParamsTab: () => <div>ParamsTab Content</div>,
}));

vi.mock(
  '@/components/mainWindow/bodyTabs/InputTabs/tabs/AuthorizationTab/AuthorizationTab',
  () => ({
    AuthorizationTab: () => <div>AuthorizationTab Content</div>,
  })
);

vi.mock('@/state/collectionStore', () => ({
  useCollectionStore: (selector: any) =>
    selector({
      selectedRequestId: 'req-1',
      requests: new Map([
        ['req-1', { id: 'req-1', headers: mockHeaders, url: { query: mockQueryParams } }],
      ]),
    }),
  selectRequest: (state: any) => state.requests.get(state.selectedRequestId),
}));

describe('InputTabs', () => {
  it('should render all four tab buttons', () => {
    // Arrange
    mockHeaders = [];

    // Act
    const { getByText } = render(<InputTabs className="" />);

    // Assert
    expect(getByText('Body')).toBeTruthy();
    expect(getByText('Parameters')).toBeTruthy();
    expect(getByText('Headers')).toBeTruthy();
    expect(getByText('Auth')).toBeTruthy();
  });

  it('should show Body tab content by default', () => {
    // Arrange
    mockHeaders = [];

    // Act
    const { getByText } = render(<InputTabs className="" />);

    // Assert
    expect(getByText('BodyTab Content')).toBeTruthy();
  });

  it('should switch from Body to Params tab', async () => {
    // Arrange
    mockHeaders = [];
    const user = userEvent.setup();
    const { getByText, queryByText } = render(<InputTabs className="" />);

    // Act
    await user.click(getByText('Parameters'));

    // Assert
    expect(getByText('ParamsTab Content')).toBeTruthy();
    expect(queryByText('BodyTab Content')).toBeNull();
  });

  it('should switch from Body to Headers tab', async () => {
    // Arrange
    mockHeaders = [];
    const user = userEvent.setup();
    const { getByText, queryByText } = render(<InputTabs className="" />);

    // Act
    await user.click(getByText('Headers'));

    // Assert
    expect(getByText('HeaderTab Content')).toBeTruthy();
    expect(queryByText('BodyTab Content')).toBeNull();
  });

  it('should switch from Body to Auth tab', async () => {
    // Arrange
    mockHeaders = [];
    const user = userEvent.setup();
    const { getByText, queryByText } = render(<InputTabs className="" />);

    // Act
    await user.click(getByText('Auth'));

    // Assert
    expect(getByText('AuthorizationTab Content')).toBeTruthy();
    expect(queryByText('BodyTab Content')).toBeNull();
  });

  it('should show active header count in tab label', () => {
    // Arrange
    mockHeaders = [
      { key: 'Content-Type', value: 'application/json', isActive: true },
      { key: 'Authorization', value: 'Bearer token', isActive: true },
      { key: 'Accept', value: 'json', isActive: false },
    ];

    // Act
    const { getByText } = render(<InputTabs className="" />);

    // Assert: 2 of 3 headers are active
    expect(getByText('Headers (2)')).toBeTruthy();
  });

  it('should show "Headers" without count when no headers are active', () => {
    // Arrange
    mockHeaders = [{ key: 'Content-Type', value: 'application/json', isActive: false }];

    // Act
    const { getByText } = render(<InputTabs className="" />);

    // Assert
    expect(getByText('Headers')).toBeTruthy();
  });
});
