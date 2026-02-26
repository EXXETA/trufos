import { render, fireEvent, cleanup } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ScriptTab } from './ScriptTab';
import { ScriptType } from 'shim/scripting';

const setCurrentScriptTypeMock = vi.fn();
let mockScriptType = ScriptType.PRE_REQUEST;

vi.mock('@/state/collectionStore', () => ({
  useCollectionActions: () => ({
    setCurrentScriptType: setCurrentScriptTypeMock,
  }),
  useCollectionStore: (selector: (state: { currentScriptType: ScriptType }) => unknown) =>
    selector({ currentScriptType: mockScriptType }),
}));

vi.mock('@/lib/monaco/MonacoEditor', () => ({
  default: () => <div data-testid="monaco-editor" />,
}));

vi.mock('@/components/shared/settings/monaco-settings', () => ({
  SCRIPT_EDITOR_OPTIONS: {},
}));

vi.mock('monaco-editor', () => ({
  editor: { createModel: vi.fn(() => ({ setValue: vi.fn() })) },
}));

vi.mock('@/components/mainWindow/bodyTabs/InputTabs/SimpleSelect', () => ({
  SimpleSelect: ({
    onValueChange,
    value,
    items,
  }: {
    onValueChange: (v: string) => void;
    value: string;
    items: [string, string][];
  }) => (
    <select
      data-testid="script-type-select"
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
    >
      {items.map(([val, label]) => (
        <option key={val} value={val}>
          {label}
        </option>
      ))}
    </select>
  ),
}));

describe('ScriptTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockScriptType = ScriptType.PRE_REQUEST;
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the Monaco editor', () => {
    const { getByTestId } = render(<ScriptTab />);
    expect(getByTestId('monaco-editor')).toBeDefined();
  });

  it('shows Pre-Request as the selected option by default', () => {
    const { getByText } = render(<ScriptTab />);
    expect(getByText('Pre-Request')).toBeDefined();
  });

  it('shows Post-Response as the selected option when currentScriptType is POST_RESPONSE', () => {
    mockScriptType = ScriptType.POST_RESPONSE;
    const { getByText } = render(<ScriptTab />);
    expect(getByText('Post-Response')).toBeDefined();
  });

  it('calls setCurrentScriptType with POST_RESPONSE when dropdown changes', () => {
    // Arrange
    const { getByTestId } = render(<ScriptTab />);
    const select = getByTestId('script-type-select');

    // Act
    fireEvent.change(select, { target: { value: ScriptType.POST_RESPONSE } });

    // Assert
    expect(setCurrentScriptTypeMock).toHaveBeenCalledWith(ScriptType.POST_RESPONSE);
  });

  it('calls setCurrentScriptType with PRE_REQUEST when switching back', () => {
    // Arrange
    mockScriptType = ScriptType.POST_RESPONSE;
    const { getByTestId } = render(<ScriptTab />);
    const select = getByTestId('script-type-select');

    // Act
    fireEvent.change(select, { target: { value: ScriptType.PRE_REQUEST } });

    // Assert
    expect(setCurrentScriptTypeMock).toHaveBeenCalledWith(ScriptType.PRE_REQUEST);
  });
});
