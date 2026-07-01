import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './render-markdown';

describe('renderMarkdown', () => {
  it('handles incomplete inline markers without hanging', () => {
    expect(renderMarkdown('a*')).toContain('a*');
    expect(renderMarkdown('[')).toContain('[');
    expect(renderMarkdown('`')).toContain('`');
  });

  it('renders normal markdown blocks', () => {
    expect(renderMarkdown('# Title\n\n- item')).toContain('<h1>Title</h1>');
    expect(renderMarkdown('# Title\n\n- item')).toContain('<li>item</li>');
  });
});
