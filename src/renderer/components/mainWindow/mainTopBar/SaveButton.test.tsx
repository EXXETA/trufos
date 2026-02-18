import { render, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, afterEach } from 'vitest';
import { SaveButton } from './SaveButton';

describe('SaveButton', () => {
  afterEach(() => {
    cleanup();
  });

  it('should call onClick when not disabled', async () => {
    // Arrange
    const onClickMock = vi.fn();
    const user = userEvent.setup();
    const { getByRole } = render(
      <SaveButton isDisabled={false} onClick={onClickMock} />
    );

    // Act
    await user.click(getByRole('button'));

    // Assert
    expect(onClickMock).toHaveBeenCalledTimes(1);
  });

  it('should not call onClick when disabled', async () => {
    // Arrange
    const onClickMock = vi.fn();
    const user = userEvent.setup();
    const { getByRole } = render(
      <SaveButton isDisabled={true} onClick={onClickMock} />
    );

    // Act
    await user.click(getByRole('button'));

    // Assert
    expect(onClickMock).not.toHaveBeenCalled();
  });
});
