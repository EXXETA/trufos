import { marked } from 'marked';

marked.setOptions({
  gfm: true,
  breaks: true,
  mangle: false,
});

export function renderMarkdown(content: string) {
  return marked.parse(content, { async: false });
}
