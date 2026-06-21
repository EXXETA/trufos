import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CollectionImport } from './CollectionImport';

const mocks = vi.hoisted(() => ({
  importCollection: vi.fn(),
  showOpenDialog: vi.fn(),
  changeCollection: vi.fn(),
}));

vi.mock('@/services/event/renderer-event-service', () => ({
  RendererEventService: {
    instance: {
      importCollection: mocks.importCollection,
      showOpenDialog: mocks.showOpenDialog,
    },
  },
}));

vi.mock('@/state/collectionStore', () => ({
  useCollectionActions: () => ({
    changeCollection: mocks.changeCollection,
  }),
}));

vi.mock('@/error/errorHandler', () => ({
  showError: vi.fn(),
}));

const collection = {
  id: 'collection-id',
  type: 'collection',
  title: 'Imported Collection',
  dirPath: '/target/Imported Collection',
  children: [],
  variables: {},
  environments: {},
  lastModified: 0,
};

describe('CollectionImport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.electron = {
      getAbsoluteFilePath: vi.fn(() => '/source/collection.trufos.zip'),
    } as never;
    mocks.importCollection.mockResolvedValue(collection);
    mocks.showOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: ['/target'],
    });
  });

  it('imports a Trufos ZIP file into the selected target directory', async () => {
    const user = userEvent.setup();
    render(<CollectionImport />);

    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    fireEvent.change(fileInput, {
      target: {
        files: [new File(['zip'], 'collection.trufos.zip', { type: 'application/zip' })],
      },
    });
    await user.click(screen.getByText('Select directory for imported collection'));
    await user.click(screen.getByRole('button', { name: /complete import/i }));

    await waitFor(() => {
      expect(mocks.importCollection).toHaveBeenCalledWith(
        '/source/collection.trufos.zip',
        '/target',
        'Trufos',
        undefined
      );
    });
    expect(mocks.changeCollection).toHaveBeenCalledWith(collection);
  });

  it('enables Trufos import only after selecting source ZIP and target directory', async () => {
    const user = userEvent.setup();
    render(<CollectionImport />);

    const submitButton = screen.getByRole<HTMLButtonElement>('button', {
      name: /complete import/i,
    });
    expect(submitButton.disabled).toBe(true);

    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    fireEvent.change(fileInput, {
      target: {
        files: [new File(['zip'], 'collection.trufos.zip', { type: 'application/zip' })],
      },
    });
    expect(submitButton.disabled).toBe(true);

    await user.click(screen.getByText('Select directory for imported collection'));
    expect(submitButton.disabled).toBe(false);
  });
});
