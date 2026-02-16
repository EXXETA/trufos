import { render, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, afterEach } from 'vitest';
import { HttpMethodSelect } from './HttpMethodSelect';
import { RequestMethod } from 'shim/objects/request-method';

describe('HttpMethodSelect', () => {
  afterEach(() => {
    cleanup();
  });

  it('should display the initially selected method', () => {
    // Arrange: Render die Component mit GET als ausgewählte Methode
    const onHttpMethodChangeMock = vi.fn();
    const { getByText } = render(
      <HttpMethodSelect
        selectedHttpMethod={RequestMethod.GET}
        onHttpMethodChange={onHttpMethodChangeMock}
      />
    );

    // Assert: Überprüfe dass "GET" im UI angezeigt wird
    expect(getByText('GET')).toBeDefined();
  });

  it('should call onHttpMethodChange when selecting a different method', async () => {
    // Arrange: Setup user interaction, mock callback, render mit GET
    const user = userEvent.setup();
    const onHttpMethodChangeMock = vi.fn();
    const { getByRole, findByText } = render(
      <HttpMethodSelect
        selectedHttpMethod={RequestMethod.GET}
        onHttpMethodChange={onHttpMethodChangeMock}
      />
    );

    // Act: Click auf das Dropdown (combobox) um es zu öffnen
    const dropdown = getByRole('combobox');
    await user.click(dropdown);

    // Act: Warte bis "POST" Option erscheint (async weil in Portal gerendert)
    // findByText ist async und wartet bis das Element erscheint
    const postOption = await findByText('POST');
    await user.click(postOption);

    // Assert: Überprüfe dass der callback mit POST aufgerufen wurde
    expect(onHttpMethodChangeMock).toHaveBeenCalledTimes(1);
    expect(onHttpMethodChangeMock).toHaveBeenCalledWith(RequestMethod.POST);
  });

  it('should work with different starting methods', async () => {
    // Arrange: Teste mit DELETE als Start-Methode
    const user = userEvent.setup();
    const onHttpMethodChangeMock = vi.fn();
    const { getByRole, getByText, findByText } = render(
      <HttpMethodSelect
        selectedHttpMethod={RequestMethod.DELETE}
        onHttpMethodChange={onHttpMethodChangeMock}
      />
    );

    // Assert: DELETE wird initial angezeigt
    expect(getByText('DELETE')).toBeDefined();

    // Act: Öffne Dropdown und wähle PATCH
    await user.click(getByRole('combobox'));
    
    // Warte bis PATCH Option erscheint (async weil in Portal gerendert)
    const patchOption = await findByText('PATCH');
    await user.click(patchOption);

    // Assert: Callback wurde mit PATCH aufgerufen
    expect(onHttpMethodChangeMock).toHaveBeenCalledWith(RequestMethod.PATCH);
  });
});
