import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { SendButton } from './SendButton';

const { mockSendRequest, mockCancelRequest } = vi.hoisted(() => ({
  mockSendRequest: vi.fn(),
  mockCancelRequest: vi.fn(),
}));

let mockIsSending = false;

vi.mock('@/hooks/request/useRequestActions', () => ({
  useSendRequest: () => ({
    sendRequest: mockSendRequest,
    cancelRequest: mockCancelRequest,
    isSending: mockIsSending,
  }),
}));

describe('SendButton', () => {
  beforeEach(() => {
    mockIsSending = false;
    mockSendRequest.mockClear();
    mockCancelRequest.mockClear();
  });

  it('should render "Send" text', () => {
    // Arrange & Act
    const { getByText } = render(<SendButton />);

    // Assert
    expect(getByText('Send')).toBeTruthy();
  });

  it('should send the request when clicked', async () => {
    // Arrange
    const user = userEvent.setup();
    const { getByText } = render(<SendButton />);

    // Act
    await user.click(getByText('Send'));

    // Assert
    expect(mockSendRequest).toHaveBeenCalledTimes(1);
    expect(mockCancelRequest).not.toHaveBeenCalled();
  });

  it('should render "Cancel" text while a request is in flight', () => {
    // Arrange
    mockIsSending = true;

    // Act
    const { getByText, queryByText } = render(<SendButton />);

    // Assert
    expect(getByText('Cancel')).toBeTruthy();
    expect(queryByText('Send')).toBeNull();
  });

  it('should cancel the request when clicked while a request is in flight', async () => {
    // Arrange
    mockIsSending = true;
    const user = userEvent.setup();
    const { getByText } = render(<SendButton />);

    // Act
    await user.click(getByText('Cancel'));

    // Assert
    expect(mockCancelRequest).toHaveBeenCalledTimes(1);
    expect(mockSendRequest).not.toHaveBeenCalled();
  });
});
