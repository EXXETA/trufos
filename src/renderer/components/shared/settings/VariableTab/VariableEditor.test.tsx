import { render, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, afterEach } from 'vitest';
import { VariableEditor } from './VariableEditor';
import { VariableObjectWithKey } from 'shim/objects/variables';

describe('VariableEditor', () => {
  afterEach(() => {
    cleanup();
  });

  it('should add a new variable when Add Variable button is clicked', async () => {
    // Arrange
    const user = userEvent.setup();
    const onVariablesChangeMock = vi.fn();
    const initialVariables: VariableObjectWithKey[] = [
      { key: 'API_KEY', value: 'test123', description: 'API Key', secret: false },
    ];

    const { getByText } = render(
      <VariableEditor variables={initialVariables} onVariablesChange={onVariablesChangeMock} />
    );

    // Act
    await user.click(getByText('Add Variable'));

    // Assert
    expect(onVariablesChangeMock).toHaveBeenCalledTimes(1);
    const newVariables = onVariablesChangeMock.mock.calls[0][0];
    expect(newVariables).toHaveLength(2);
    expect(newVariables[1]).toEqual({
      key: '',
      value: '',
      description: '',
      secret: false,
    });
  });

  it('should remove a variable when trash icon is clicked', async () => {
    // Arrange
    const user = userEvent.setup();
    const onVariablesChangeMock = vi.fn();
    const initialVariables: VariableObjectWithKey[] = [
      { key: 'API_KEY', value: 'test123', description: 'API Key', secret: false },
      { key: 'DB_HOST', value: 'localhost', description: 'Database', secret: false },
    ];

    const { getAllByRole } = render(
      <VariableEditor variables={initialVariables} onVariablesChange={onVariablesChangeMock} />
    );

    // Act - Click first trash button
    const trashButtons = getAllByRole('button', { name: '' }).filter((btn) =>
      btn.querySelector('svg')?.classList.contains('lucide-trash-2')
    );
    await user.click(trashButtons[0]);

    // Assert
    expect(onVariablesChangeMock).toHaveBeenCalledTimes(1);
    const newVariables = onVariablesChangeMock.mock.calls[0][0];
    expect(newVariables).toHaveLength(1);
    expect(newVariables[0].key).toBe('DB_HOST');
  });

  it('should not add a new variable if an empty one already exists', async () => {
    // Arrange
    const user = userEvent.setup();
    const onVariablesChangeMock = vi.fn();
    const initialVariables: VariableObjectWithKey[] = [
      { key: '', value: '', description: '', secret: false },
    ];

    const { getByText } = render(
      <VariableEditor variables={initialVariables} onVariablesChange={onVariablesChangeMock} />
    );

    // Act
    await user.click(getByText('Add Variable'));

    // Assert
    expect(onVariablesChangeMock).not.toHaveBeenCalled();
  });

  it('should allow removing all variables', async () => {
    // Arrange
    const user = userEvent.setup();
    const onVariablesChangeMock = vi.fn();
    const initialVariables: VariableObjectWithKey[] = [
      { key: 'API_KEY', value: 'test123', description: 'API Key', secret: false },
    ];

    const { getAllByRole } = render(
      <VariableEditor variables={initialVariables} onVariablesChange={onVariablesChangeMock} />
    );

    // Act
    const trashButtons = getAllByRole('button', { name: '' }).filter((btn) =>
      btn.querySelector('svg')?.classList.contains('lucide-trash-2')
    );
    await user.click(trashButtons[0]);

    // Assert
    expect(onVariablesChangeMock).toHaveBeenCalledTimes(1);
    const newVariables = onVariablesChangeMock.mock.calls[0][0];
    expect(newVariables).toHaveLength(0);
  });

  it('should add multiple variables sequentially', async () => {
    // Arrange
    const user = userEvent.setup();
    const variables: VariableObjectWithKey[] = [];
    let currentVariables = variables;

    const { getByText, rerender } = render(
      <VariableEditor
        variables={currentVariables}
        onVariablesChange={(newVars) => {
          currentVariables = newVars;
        }}
      />
    );

    // Act - Add first variable
    await user.click(getByText('Add Variable'));
    rerender(
      <VariableEditor
        variables={currentVariables}
        onVariablesChange={(newVars) => {
          currentVariables = newVars;
        }}
      />
    );

    // Assert - First variable added
    expect(currentVariables).toHaveLength(1);

    // Act - Simulate filling first variable with key
    currentVariables = [{ key: 'VAR1', value: '', description: '', secret: false }];
    rerender(
      <VariableEditor
        variables={currentVariables}
        onVariablesChange={(newVars) => {
          currentVariables = newVars;
        }}
      />
    );

    // Act - Add second variable
    await user.click(getByText('Add Variable'));
    rerender(
      <VariableEditor
        variables={currentVariables}
        onVariablesChange={(newVars) => {
          currentVariables = newVars;
        }}
      />
    );

    // Assert - Second variable added
    expect(currentVariables).toHaveLength(2);
  });
});
