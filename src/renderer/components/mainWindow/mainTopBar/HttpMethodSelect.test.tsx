import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect } from 'vitest';
import { HttpMethodSelect } from './HttpMethodSelect';
import { RequestMethod } from 'shim/objects/request-method';

describe('HttpMethodSelect', () => {
  it('should display the initially selected method', () => {
    // Arrange
    const onHttpMethodChangeMock = vi.fn();
    const { getByText } = render(
      <HttpMethodSelect
        selectedHttpMethod={RequestMethod.GET}
        onHttpMethodChange={onHttpMethodChangeMock}
      />
    );

    // Assert
    expect(getByText('GET')).toBeDefined();
  });

  it('should call onHttpMethodChange when selecting a different method', async () => {
    // Arrange
    const user = userEvent.setup();
    const onHttpMethodChangeMock = vi.fn();
    const { getByRole, findByText } = render(
      <HttpMethodSelect
        selectedHttpMethod={RequestMethod.GET}
        onHttpMethodChange={onHttpMethodChangeMock}
      />
    );

    // Act
    const dropdown = getByRole('combobox');
    await user.click(dropdown);
    const postOption = await findByText('POST');
    await user.click(postOption);

    // Assert
    expect(onHttpMethodChangeMock).toHaveBeenCalledTimes(1);
    expect(onHttpMethodChangeMock).toHaveBeenCalledWith(RequestMethod.POST);
  });

  it('should work with different starting methods', async () => {
    // Arrange
    const user = userEvent.setup();
    const onHttpMethodChangeMock = vi.fn();
    const { getByRole, getByText, findByText } = render(
      <HttpMethodSelect
        selectedHttpMethod={RequestMethod.DELETE}
        onHttpMethodChange={onHttpMethodChangeMock}
      />
    );

    // Assert
    expect(getByText('DELETE')).toBeDefined();

    // Act
    await user.click(getByRole('combobox'));
    const patchOption = await findByText('PATCH');
    await user.click(patchOption);

    // Assert
    expect(onHttpMethodChangeMock).toHaveBeenCalledWith(RequestMethod.PATCH);
  });
});
