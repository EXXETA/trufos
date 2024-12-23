import 'monaco-editor';

// this extends the monaco editor types with some internal methods that are not exposed in the types
declare module 'monaco-editor' {
  namespace editor {
    interface ITextModel {
      undo(): void | Promise<void>;

      canUndo: () => boolean;

      redo(): void | Promise<void>;

      canRedo: () => boolean;
    }
  }
}
