import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CollectionTrustBanner } from './CollectionTrustBanner';

const { eventService, collectionState } = vi.hoisted(() => ({
  eventService: { isCollectionTrusted: vi.fn(), trustCollection: vi.fn() },
  collectionState: { collection: { dirPath: '/trusted' } },
}));

vi.mock('@/services/event/renderer-event-service', () => ({
  RendererEventService: { instance: eventService },
}));

vi.mock('@/state/collectionStore', () => ({
  useCollectionStore: (selector: (state: typeof collectionState) => unknown) =>
    selector(collectionState),
}));

/** Opens the collection in the given directory. */
function openCollection(dirPath: string) {
  collectionState.collection = { dirPath };
}

const TRUST_BUTTON = { name: 'Trust collection' };

describe('CollectionTrustBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eventService.trustCollection.mockResolvedValue(undefined);
  });

  it('shows nothing for a trusted collection', async () => {
    eventService.isCollectionTrusted.mockResolvedValue(true);

    openCollection('/trusted');
    render(<CollectionTrustBanner />);

    await waitFor(() => expect(eventService.isCollectionTrusted).toHaveBeenCalledWith('/trusted'));
    expect(screen.queryByRole('button', TRUST_BUTTON)).toBeNull();
  });

  it('trusts a collection that is not trusted yet', async () => {
    eventService.isCollectionTrusted.mockResolvedValue(false);
    openCollection('/cloned');
    render(<CollectionTrustBanner />);

    await userEvent.click(await screen.findByRole('button', TRUST_BUTTON));

    expect(eventService.trustCollection).toHaveBeenCalledWith('/cloned');
    await waitFor(() => expect(screen.queryByRole('button', TRUST_BUTTON)).toBeNull());
  });

  it('checks the trust again when another collection is opened', async () => {
    eventService.isCollectionTrusted.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    openCollection('/trusted');
    const { rerender } = render(<CollectionTrustBanner />);
    await waitFor(() => expect(eventService.isCollectionTrusted).toHaveBeenCalledTimes(1));

    openCollection('/cloned');
    rerender(<CollectionTrustBanner />);

    await screen.findByRole('button', TRUST_BUTTON);
    expect(eventService.isCollectionTrusted).toHaveBeenLastCalledWith('/cloned');
  });
});
