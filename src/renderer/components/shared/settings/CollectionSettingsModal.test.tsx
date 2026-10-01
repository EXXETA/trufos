import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { CollectionSettingsModal } from './CollectionSettingsModal';

vi.mock('@/state/variableStore', () => ({
  selectVariables: (s: { variables: object }) => s.variables,
  useVariableActions: () => ({ setVariables: vi.fn() }),
  useVariableStore: (selector: (s: { variables: object }) => unknown) =>
    selector({ variables: {} }),
}));

vi.mock('@/state/environmentStore', () => ({
  selectEnvironments: (s: { environments: object }) => s.environments,
  selectSelectedEnvironment: (s: { selectedEnvironment?: string }) => s.selectedEnvironment,
  useEnvironmentActions: () => ({ setEnvironments: vi.fn(), selectEnvironment: vi.fn() }),
  useEnvironmentStore: (selector: (s: { environments: object }) => unknown) =>
    selector({ environments: {} }),
}));

vi.mock('@/state/collectionStore', () => ({
  useCollectionActions: () => ({ setClientCertificate: vi.fn(), renameCollection: vi.fn() }),
  useCollectionStore: (
    selector: (s: { collection: { title: string; clientCertificate: null } }) => unknown
  ) => selector({ collection: { title: 'My Collection', clientCertificate: null } }),
}));

vi.mock('@/components/shared/settings/GeneralTab/GeneralEditor', () => ({
  GeneralEditor: ({
    name,
    onNameChange,
  }: {
    name: string;
    onNameChange: (name: string) => void;
  }) => <input aria-label="name" value={name} onChange={(e) => onNameChange(e.target.value)} />,
}));
vi.mock('@/components/shared/settings/VariableTab/VariableEditor', () => ({
  VariableEditor: () => null,
  getInvalidVariableKeys: () => new Set<string>(),
}));
vi.mock('@/components/shared/settings/EnvironmentTab/EnvironmentEditor', () => ({
  EnvironmentEditor: () => null,
}));
vi.mock('@/components/shared/settings/TlsTab/CertificateEditor', () => ({
  CertificateEditor: () => null,
}));
vi.mock('@/components/shared/settings/ExportTab/ExportEditor', () => ({
  ExportEditor: () => null,
}));

describe('CollectionSettingsModal', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls onClose when Cancel is clicked', async () => {
    const user = userEvent.setup();
    render(<CollectionSettingsModal isOpen={true} onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('disables Save when nothing has changed', () => {
    render(<CollectionSettingsModal isOpen={true} onClose={onClose} />);

    const save = screen.getByRole('button', { name: /^save$/i });
    expect((save as HTMLButtonElement).disabled).toBe(true);
  });

  it('enables Save after a change', async () => {
    const user = userEvent.setup();
    render(<CollectionSettingsModal isOpen={true} onClose={onClose} />);

    await user.type(screen.getByLabelText('name'), 'x');

    const save = screen.getByRole('button', { name: /^save$/i });
    expect((save as HTMLButtonElement).disabled).toBe(false);
  });
});
