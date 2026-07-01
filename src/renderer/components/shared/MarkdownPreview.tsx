import { cn } from '@/lib/utils';
import { renderMarkdown } from '@/lib/markdown/render-markdown';

export interface MarkdownPreviewProps {
  content: string;
  className?: string;
}

export function MarkdownPreview({ content, className }: MarkdownPreviewProps) {
  return (
    <div
      className={cn(
        'space-y-1 text-sm leading-6 [&>p]:mb-2 [&>p:last-child]:mb-0 [&>ul]:mb-2 [&>ol]:mb-2 [&>blockquote]:mb-2 [&>pre]:mb-2',
        className
      )}
      dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
    />
  );
}
