import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IndexedImporter } from 'shim/plugin';
import { usePluginStore } from '@/state/pluginStore';
import { CollectionImport } from './CollectionImport';

vi.mock('@/services/event/renderer-event-service', () => ({
  RendererEventService: { instance: {} },
}));

vi.mock('@/state/collectionStore', () => ({
  useCollectionActions: () => ({ changeCollection: vi.fn() }),
}));

/** Puts the given importers of plugins into the plugin store. */
function receiveImporters(...importers: IndexedImporter[]) {
  usePluginStore.getState().receive({ plugins: [], contributions: { importers, exporters: [] } });
}

function importer(overrides: Partial<IndexedImporter> = {}): IndexedImporter {
  return {
    id: 'postman.collection',
    pluginId: 'postman',
    name: 'Postman',
    source: 'file',
    extensions: ['json'],
    ...overrides,
  };
}

describe('CollectionImport', () => {
  beforeEach(() => {
    receiveImporters();
  });

  it('shows a tab for every importer of a plugin', () => {
    receiveImporters(
      importer(),
      importer({ id: 'insomnia.collection', pluginId: 'insomnia', name: 'Insomnia v4' })
    );

    render(<CollectionImport />);

    expect(screen.getByRole('tab', { name: 'Postman' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Insomnia v4' })).toBeTruthy();
  });

  it('shows no tab for an importer without a plugin', () => {
    render(<CollectionImport />);

    expect(screen.queryByRole('tab', { name: 'Postman' })).toBeNull();
  });

  it('accepts the file types of a file importer', async () => {
    receiveImporters(importer({ extensions: ['json', 'yaml'] }));
    render(<CollectionImport />);

    await userEvent.click(screen.getByRole('tab', { name: 'Postman' }));

    expect(screen.getByText('Postman exports .json or .yaml files')).toBeTruthy();
    expect(document.querySelector('input[type="file"]')?.getAttribute('accept')).toBe(
      '.json,.yaml'
    );
  });

  it('asks a directory importer for a directory', async () => {
    receiveImporters(importer({ name: 'Hoppscotch', source: 'directory', extensions: [] }));
    render(<CollectionImport />);

    await userEvent.click(screen.getByRole('tab', { name: 'Hoppscotch' }));

    expect(screen.getByText('Select Hoppscotch collection directory')).toBeTruthy();
    expect(screen.getByText('Select directory for new collection')).toBeTruthy();
  });

  it('shows the built-in importers like the ones of plugins', async () => {
    render(<CollectionImport />);

    await userEvent.click(screen.getByRole('tab', { name: 'OpenAPI' }));
    expect(screen.getByText('OpenAPI exports .json, .yaml, or .yml files')).toBeTruthy();

    await userEvent.click(screen.getByRole('tab', { name: 'Bruno' }));
    expect(screen.getByText('Select Bruno collection directory')).toBeTruthy();
  });
});
