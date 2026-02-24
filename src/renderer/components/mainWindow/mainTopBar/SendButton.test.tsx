import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect } from 'vitest';
import { SendButton } from './SendButton';

describe('SendButton', () => {
  it('should render "Send" text', () => {
    // Arrange & Act
    const { getByText } = render(<SendButton onClick={() => {}} />);

    // Assert
    expect(getByText('Send')).toBeTruthy();
  });

  it('should call onClick when clicked', async () => {
    // Arrange
    const onClickMock = vi.fn();
    const user = userEvent.setup();
    const { getByText } = render(<SendButton onClick={onClickMock} />);

    // Act
    await user.click(getByText('Send'));

    // Assert
    expect(onClickMock).toHaveBeenCalledTimes(1);
  });

  it('should not call onClick when disabled', async () => {
    // Arrange
    const onClickMock = vi.fn();
    const user = userEvent.setup();
    const { getByText } = render(<SendButton onClick={onClickMock} disabled />);

    // Act
    await user.click(getByText('Send'));

    // Assert
    expect(onClickMock).not.toHaveBeenCalled();
  });
});
