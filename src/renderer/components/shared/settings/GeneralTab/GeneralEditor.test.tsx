import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { GeneralEditor } from './GeneralEditor';

const { closeCollection, listCollections } = vi.hoisted(() => ({
  closeCollection: vi.fn(),
  listCollections: vi.fn(),
}));

vi.mock('@/state/collectionStore', () => ({
  useCollectionActions: () => ({ closeCollection }),
  useCollectionStore: (selector: (s: { collection: { isDefault: boolean } }) => unknown) =>
    selector({ collection: { isDefault: false } }),
}));

vi.mock('@/services/event/renderer-event-service', () => ({
  RendererEventService: { instance: { listCollections } },
}));

describe('GeneralEditor close collection button', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('closes the collection and notifies the parent when clicked', async () => {
    listCollections.mockResolvedValue([{}, {}]);
    const onCloseCollection = vi.fn();
    const user = userEvent.setup();
    render(<GeneralEditor name="a" onNameChange={vi.fn()} onCloseCollection={onCloseCollection} />);

    await waitFor(() => expect(listCollections).toHaveBeenCalled());
    const button = screen.getByRole<HTMLButtonElement>('button', { name: 'Close' });
    await waitFor(() => expect(button.disabled).toBe(false));
    await user.click(button);

    expect(closeCollection).toHaveBeenCalledOnce();
    expect(onCloseCollection).toHaveBeenCalledOnce();
  });

  it('is disabled when only one collection is open', async () => {
    listCollections.mockResolvedValue([{}]);
    render(<GeneralEditor name="a" onNameChange={vi.fn()} onCloseCollection={vi.fn()} />);

    await waitFor(() =>
      expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Close' }).disabled).toBe(true)
    );
  });

  it('uses the danger tint without leftover destructive classes', async () => {
    listCollections.mockResolvedValue([{}, {}]);
    render(<GeneralEditor name="a" onNameChange={vi.fn()} onCloseCollection={vi.fn()} />);

    await waitFor(() => expect(listCollections).toHaveBeenCalled());
    const button = screen.getByRole<HTMLButtonElement>('button', { name: 'Close' });
    await waitFor(() => expect(button.disabled).toBe(false));
    const className = button.className;
    expect(className).toContain('active:bg-danger');
    expect(className).toContain('active:border-danger');
    expect(className).toContain('active:text-background-primary');
    expect(className).not.toContain('active:bg-accent-secondary');
    expect(className).not.toMatch(/destructive/);
    expect(className).toContain('bg-danger/10');
    expect(className).toContain('hover:bg-danger');
    expect(className).toContain('hover:text-background-primary');
  });
});
