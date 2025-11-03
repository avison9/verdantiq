import { Copy, Check, Code2 } from 'lucide-react';
import { useState } from 'react';

interface CodeBlockProps {
  code: string;
  language?: string;
}

export function CodeBlock({ code, language = "javascript" }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      <div className="flex items-center justify-between px-4 py-3 bg-muted/50 rounded-t-lg border border-b-0 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Code2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground capitalize font-medium">{language}</span>
        </div>
        <button 
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs bg-background px-3 py-1.5 rounded-md border hover:bg-accent transition-all duration-200 hover:scale-105 font-medium"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-green-600" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              Copy
            </>
          )}
        </button>
      </div>
      <pre className="bg-card/50 border rounded-b-lg p-4 overflow-x-auto backdrop-blur-sm">
        <code className="text-sm leading-relaxed">{code}</code>
      </pre>
    </div>
  );
}