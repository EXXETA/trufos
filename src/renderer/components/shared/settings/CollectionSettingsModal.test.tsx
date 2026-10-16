import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { CollectionSettingsModal } from './CollectionSettingsModal';

const { actions } = vi.hoisted(() => ({
  actions: {
    updateCollection: vi.fn(async () => true),
    selectEnvironment: vi.fn(async () => true),
  },
}));

vi.mock('@/state/collectionStore', () => {
  const state = {
    collection: {
      title: 'My Collection',
      clientCertificate: null,
      variables: {},
      environments: {},
    },
    selectedEnvironmentKey: undefined,
  };
  return {
    useCollectionActions: () => actions,
    useCollectionStore: (selector: (s: typeof state) => unknown) => selector(state),
  };
});

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

  it('disables Save when the title is blank', async () => {
    const user = userEvent.setup();
    render(<CollectionSettingsModal isOpen={true} onClose={onClose} />);

    await user.clear(screen.getByLabelText('name'));
    await user.type(screen.getByLabelText('name'), ' ');

    const save = screen.getByRole('button', { name: /^save$/i });
    expect((save as HTMLButtonElement).disabled).toBe(true);
  });

  it('saves only the changed settings', async () => {
    const user = userEvent.setup();
    render(<CollectionSettingsModal isOpen={true} onClose={onClose} />);

    await user.type(screen.getByLabelText('name'), ' Renamed');
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    expect(actions.updateCollection).toHaveBeenCalledExactlyOnceWith({
      title: 'My Collection Renamed',
    });
    expect(actions.selectEnvironment).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('stays open if saving failed', async () => {
    const user = userEvent.setup();
    actions.updateCollection.mockResolvedValueOnce(false);
    render(<CollectionSettingsModal isOpen={true} onClose={onClose} />);

    await user.type(screen.getByLabelText('name'), ' Renamed');
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    expect(actions.updateCollection).toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
