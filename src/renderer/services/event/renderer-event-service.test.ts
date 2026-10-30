import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MainProcessError } from '@/error/MainProcessError';
import { DisplayableError } from 'shim/error/DisplayableError';
import { RendererEventService } from './renderer-event-service';

describe('RendererEventService', () => {
  const invoke = vi.fn();
  const eventService = RendererEventService.instance;

  beforeEach(() => {
    invoke.mockReset();
    vi.stubGlobal('electron', { ipcRenderer: { invoke } });
  });

  it('returns the value of a successful call', async () => {
    invoke.mockResolvedValueOnce({ ok: true, value: '1.2.3' });

    await expect(eventService.getAppVersion()).resolves.toBe('1.2.3');

    expect(invoke).toHaveBeenCalledWith('getAppVersion');
  });

  it('returns a value that looks like a serialized error', async () => {
    const value = { __displayableError: true, title: 'title', description: 'description' };
    invoke.mockResolvedValueOnce({ ok: true, value });

    await expect(eventService.getAppSettings()).resolves.toBe(value);
  });

  it('throws a serialized DisplayableError with its title and description', async () => {
    const error = new DisplayableError('description', 'title');
    invoke.mockResolvedValueOnce({ ok: false, error: error.serialize() });

    const thrown = await eventService.getAppVersion().catch((e: unknown) => e);

    expect(thrown).toBeInstanceOf(DisplayableError);
    expect(thrown).toMatchObject({ title: 'title', description: 'description' });
  });

  it('throws any other error as a MainProcessError', async () => {
    invoke.mockResolvedValueOnce({ ok: false, error: new Error('failed') });

    const thrown = await eventService.getAppVersion().catch((e: unknown) => e);

    expect(thrown).toBeInstanceOf(MainProcessError);
    expect(thrown).toMatchObject({ message: 'failed' });
  });
});
