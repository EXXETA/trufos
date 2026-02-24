import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect } from 'vitest';
import { SaveButton } from './SaveButton';

describe('SaveButton', () => {
  it('should call onClick when not disabled', async () => {
    // Arrange
    const onClickMock = vi.fn();
    const user = userEvent.setup();
    const { getByRole } = render(<SaveButton isDisabled={false} onClick={onClickMock} />);

    // Act
    await user.click(getByRole('button'));

    // Assert
    expect(onClickMock).toHaveBeenCalledTimes(1);
  });

  it('should not call onClick when disabled', async () => {
    // Arrange
    const onClickMock = vi.fn();
    const user = userEvent.setup();
    const { getByRole } = render(<SaveButton isDisabled={true} onClick={onClickMock} />);

    // Act
    await user.click(getByRole('button'));

    // Assert
    expect(onClickMock).not.toHaveBeenCalled();
  });
});
