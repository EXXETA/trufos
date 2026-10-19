import { render, waitFor } from '@testing-library/react';
import { beforeAll, describe, it, expect, vi } from 'vitest';
import { loader } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import type { editor } from 'monaco-editor';

/**
 * The real monaco-editor core cannot run under jsdom (it throws while building its theme/CSS, since
 * jsdom has no layout engine), so the real `@monaco-editor/react` editor runs on a lightweight fake
 * of monaco. The library loads its loader with `require()`, which `vi.mock` does not intercept, so
 * the fake is handed to the real loader via `loader.config()`, as `config.ts` does in the app.
 */

/** Returns a fake whose own members are used, and every other method returns a disposable. */
function fake<T extends object>(target: T): T {
  return new Proxy(target, {
    get: (target, prop) => (prop in target ? target[prop as keyof T] : () => ({ dispose() {} })),
  });
}

function makeFakeModel(id: string) {
  return fake({ uri: { toString: () => id }, dispose: vi.fn() });
}

function makeFakeEditor() {
  let model: unknown = makeFakeModel('default');
  return fake({
    getModel: () => model,
    setModel: (next: unknown) => {
      model = next;
    },
    dispose: vi.fn(),
  });
}

const fakeMonaco = {
  editor: fake({ create: () => makeFakeEditor(), getModel: () => null }),
  languages: fake({}),
  Uri: { parse: (uri: string) => ({ toString: () => uri }) },
};

vi.mock('@/contexts/ThemeContext', () => ({
  TrufosTheme: { Light: 'light', Dark: 'dark' },
  useTheme: () => ({ theme: 'light' }),
}));
vi.mock('monaco-editor', () => ({ editor: {} }));
// configuring the loader is covered by MonacoEditor.loader.test.ts
vi.mock('./config', () => ({}));

import MonacoEditor from './MonacoEditor';

/** Renders the editor and waits until the real `@monaco-editor/react` editor is mounted. */
async function renderEditor(model: editor.ITextModel) {
  const onMount = vi.fn();
  const result = render(<MonacoEditor model={model} onMount={onMount} />);
  await waitFor(() => expect(onMount).toHaveBeenCalled());
  const instance: editor.ICodeEditor = onMount.mock.calls[0][0];
  return { ...result, instance };
}

describe('MonacoEditor', () => {
  beforeAll(() => {
    loader.config({ monaco: fakeMonaco as unknown as typeof Monaco });
  });

  it('mounts the real @monaco-editor/react editor with the given model', async () => {
    // Arrange
    const model = makeFakeModel('shared');

    // Act
    const { instance, unmount } = await renderEditor(model as unknown as editor.ITextModel);

    // Assert
    expect(instance.getModel()).toBe(model);
    expect(() => unmount()).not.toThrow();
  });

  it('keeps the shared model alive on unmount', async () => {
    // Arrange: the model is owned by the model registry, not by the editor
    const model = makeFakeModel('shared');
    const { instance, unmount } = await renderEditor(model as unknown as editor.ITextModel);

    // Act
    unmount();

    // Assert
    expect(instance.dispose).toHaveBeenCalled();
    expect(model.dispose).not.toHaveBeenCalled();
  });
});
