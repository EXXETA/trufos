import { FC, useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import MonacoEditor from '@/lib/monaco/MonacoEditor';
import { generateCodeSnippet } from '@/services/http/code-generator-service';
import { TrufosRequest } from 'shim/objects/request';
import { VariableObject } from 'shim/objects/variables';
import { useCollectionStore } from '@/state/collectionStore';
import { RendererEventService } from '@/services/event/renderer-event-service';
import { REQUEST_EDITOR_OPTIONS } from '@/components/shared/settings/monaco-settings';
import { Terminal, Braces, Code2, Copy, Check, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CodeGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: TrufosRequest;
}

const LOCAL_STORAGE_KEY = 'trufos:last-code-gen-target';

const TARGET_LANGUAGES = [
  { value: 'curl', label: 'cURL', lang: 'shell', icon: Terminal },
  { value: 'fetch_js', label: 'JS Fetch', lang: 'javascript', icon: Code2 },
  { value: 'fetch_ts', label: 'TS Fetch', lang: 'typescript', icon: ShieldCheck },
  { value: 'axios', label: 'Axios', lang: 'javascript', icon: Braces },
  { value: 'python', label: 'Python Requests', lang: 'python', icon: Code2 },
];

export const CodeGeneratorModal: FC<CodeGeneratorModalProps> = ({ isOpen, onClose, request }) => {
  const [target, setTarget] = useState<string>(() => {
    return localStorage.getItem(LOCAL_STORAGE_KEY) || 'curl';
  });

  const [activeVariables, setActiveVariables] = useState<[string, VariableObject][]>([]);
  const [copied, setCopied] = useState(false);

  const collection = useCollectionStore((state) => state.collection);
  const eventService = RendererEventService.instance;

  // Load active variables when modal is open
  useEffect(() => {
    if (isOpen) {
      eventService.getActiveEnvironmentVariables().then((vars) => {
        setActiveVariables(vars);
      });
    }
  }, [isOpen]);

  // Reset copy feedback state when target changes
  useEffect(() => {
    setCopied(false);
  }, [target]);

  const handleTargetSelect = (val: string) => {
    setTarget(val);
    localStorage.setItem(LOCAL_STORAGE_KEY, val);
  };

  const snippet = useMemo(() => {
    return generateCodeSnippet(target, request, collection?.auth, activeVariables);
  }, [target, request, collection?.auth, activeVariables]);

  const selectedTarget = useMemo(() => {
    return TARGET_LANGUAGES.find((t) => t.value === target) || TARGET_LANGUAGES[0];
  }, [target]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code snippet:', err);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="text-text-primary border-divider flex h-[600px] max-w-4xl flex-col overflow-hidden rounded-xl border bg-[#141517] p-0 shadow-2xl">
        {/* Full Width Header */}
        <div className="border-divider/60 flex shrink-0 items-center justify-between border-b bg-[#16181a] px-6 py-4">
          <div>
            <h2 className="text-text-primary flex items-center gap-2 text-sm font-semibold tracking-wide uppercase">
              <Code2 size={16} className="text-purple-400" />
              Code Generator
            </h2>
            <p className="text-text-secondary mt-0.5 text-[11px]">
              Export this request into a code snippet for integration or sharing.
            </p>
          </div>
          {/* Spacer to avoid close button overlap */}
          <div className="w-10 shrink-0" />
        </div>

        {/* Content Pane */}
        <div className="flex min-h-0 flex-1">
          {/* Left: Language Selection */}
          <div className="border-divider/60 flex w-[200px] shrink-0 flex-col space-y-1 border-r bg-[#121315] p-3 select-none">
            <span className="text-text-disabled mb-2 px-2 text-[10px] font-semibold uppercase">
              Select Language
            </span>
            {TARGET_LANGUAGES.map((lang) => {
              const Icon = lang.icon;
              const isActive = lang.value === target;
              return (
                <button
                  key={lang.value}
                  onClick={() => handleTargetSelect(lang.value)}
                  className={cn(
                    'relative flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-left text-xs font-medium transition-colors duration-150',
                    isActive
                      ? 'bg-[#1d1e20] text-[#c084fc]'
                      : 'text-text-secondary hover:text-text-primary hover:bg-[#161719]'
                  )}
                >
                  {isActive && (
                    <span className="absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-r bg-[#a855f7]" />
                  )}
                  <Icon
                    size={14}
                    className={cn('shrink-0', isActive ? 'text-[#a855f7]' : 'text-text-disabled')}
                  />
                  {lang.label}
                </button>
              );
            })}
          </div>

          {/* Right: Code Viewer */}
          <div className="relative flex min-w-0 flex-1 flex-col bg-[#1e1e1e]">
            {/* Editor Gutter / Info bar */}
            <div className="border-divider/40 flex shrink-0 items-center justify-between border-b bg-[#1b1c1e] px-6 py-2 select-none">
              <span className="text-text-disabled text-[10px] font-medium tracking-wide uppercase">
                {selectedTarget.label} Snippet
              </span>
            </div>

            {/* Monaco Editor */}
            <div className="relative min-h-0 flex-1">
              <MonacoEditor
                key={`${target}-${request.id}`}
                height="100%"
                className="absolute inset-0"
                language={selectedTarget.lang}
                value={snippet}
                options={{
                  ...REQUEST_EDITOR_OPTIONS,
                  readOnly: true,
                  lineNumbers: 'on',
                  minimap: { enabled: false },
                  scrollbar: {
                    verticalScrollbarSize: 8,
                    horizontalScrollbarSize: 8,
                  },
                  lineDecorationsWidth: 4,
                  lineNumbersMinChars: 3,
                }}
              />

              {/* Floating Copy Button inside Editor (GitHub Style) */}
              <div className="absolute top-3 right-3 z-10">
                <Button
                  size="sm"
                  variant="secondary"
                  className={cn(
                    'h-7 cursor-pointer gap-1.5 rounded-md border px-3 text-[11px] font-medium shadow-md focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible:outline-none',
                    copied
                      ? 'border-green-800/60 bg-green-950/40 text-green-400'
                      : 'text-text-primary border-divider/60 bg-[#252627]'
                  )}
                  onClick={handleCopy}
                >
                  {copied ? (
                    <>
                      <Check size={12} />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy size={12} />
                      Copy Snippet
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
