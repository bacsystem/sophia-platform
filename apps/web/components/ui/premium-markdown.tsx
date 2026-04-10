'use client';

import { useEffect, useState, useCallback, type ComponentPropsWithoutRef } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check } from 'lucide-react';

/* -------------------------------------------------------------------------- */
/*  Shiki highlighter (lazy singleton — loaded once, code-split)              */
/* -------------------------------------------------------------------------- */

let highlighterPromise: Promise<(code: string, lang: string) => Promise<string>> | null = null;

function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = import('shiki').then(({ codeToHtml }) => {
      return (code: string, lang: string) =>
        codeToHtml(code, { lang, theme: 'github-dark' });
    });
  }
  return highlighterPromise;
}

/* -------------------------------------------------------------------------- */
/*  Code Block with syntax highlighting + copy button                         */
/* -------------------------------------------------------------------------- */

function CodeBlock({ className, children }: { className?: string; children: string }) {
  const [html, setHtml] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const lang = className?.replace('language-', '') ?? 'text';
  const code = String(children).replace(/\n$/, '');

  useEffect(() => {
    let cancelled = false;
    getHighlighter()
      .then((highlight) => highlight(code, lang))
      .then((result) => { if (!cancelled) setHtml(result); })
      .catch(() => { /* fallback: no highlighting */ });
    return () => { cancelled = true; };
  }, [code, lang]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  return (
    <div className="group relative my-4 rounded-xl overflow-hidden border border-[var(--muted-border)] bg-[var(--surface-console)]">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[var(--surface-header)] border-b border-[var(--muted-border)]">
        <span className="text-[11px] font-mono text-[var(--text-disabled)] uppercase tracking-wider">{lang}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 text-[11px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
          aria-label="Copiar código"
        >
          {copied ? <Check className="w-3 h-3 text-[var(--color-success)]" /> : <Copy className="w-3 h-3" />}
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
      {/* Code */}
      <div className="overflow-x-auto p-4">
        {html ? (
          <div
            className="shiki-container text-[13px] leading-relaxed [&>pre]:!bg-transparent [&>pre]:!p-0 [&>pre]:!m-0 [&_code]:!bg-transparent"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <pre className="text-[13px] leading-relaxed text-[var(--text-secondary)] font-mono whitespace-pre-wrap">
            <code>{code}</code>
          </pre>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Inline code                                                               */
/* -------------------------------------------------------------------------- */

function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="px-1.5 py-0.5 rounded-md bg-[rgba(var(--accent-rgb)/0.10)] border border-[rgba(var(--accent-rgb)/0.20)] text-[var(--accent-400)] text-[0.875em] font-mono">
      {children}
    </code>
  );
}

/* -------------------------------------------------------------------------- */
/*  Custom components map for react-markdown                                  */
/* -------------------------------------------------------------------------- */

type PreProps = ComponentPropsWithoutRef<'pre'>;

const components = {
  // Headings — typographic hierarchy
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="text-2xl font-bold text-[var(--text-primary)] mt-8 mb-4 pb-3 border-b border-[var(--muted-border)] first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="text-xl font-semibold text-[var(--text-primary)] mt-8 mb-3 pb-2 border-b border-[var(--muted-border)]">
      <span className="text-[var(--accent-400)] mr-2">##</span>{children}
    </h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="text-lg font-semibold text-[var(--text-primary)] mt-6 mb-2">{children}</h3>
  ),
  h4: ({ children }: { children?: React.ReactNode }) => (
    <h4 className="text-base font-semibold text-[var(--text-primary)] mt-5 mb-2">{children}</h4>
  ),
  h5: ({ children }: { children?: React.ReactNode }) => (
    <h5 className="text-sm font-semibold text-[var(--text-secondary)] mt-4 mb-1 uppercase tracking-wide">{children}</h5>
  ),
  h6: ({ children }: { children?: React.ReactNode }) => (
    <h6 className="text-sm font-medium text-[var(--text-secondary)] mt-4 mb-1">{children}</h6>
  ),

  // Paragraphs
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="text-[15px] leading-7 text-[var(--text-secondary)] mb-4">{children}</p>
  ),

  // Strong / emphasis
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold text-[var(--text-primary)]">{children}</strong>
  ),
  em: ({ children }: { children?: React.ReactNode }) => (
    <em className="text-[var(--text-secondary)] italic">{children}</em>
  ),

  // Links
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[var(--accent-400)] hover:text-[var(--accent-300)] underline underline-offset-2 decoration-[rgba(var(--accent-rgb)/0.40)] hover:decoration-[rgba(var(--accent-rgb)/0.60)] transition-colors"
    >
      {children}
    </a>
  ),

  // Blockquotes
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="my-4 pl-4 border-l-2 border-[rgba(var(--accent-rgb)/0.40)] bg-[rgba(var(--accent-rgb)/0.04)] rounded-r-lg py-2 pr-4 [&>p]:text-[var(--text-secondary)] [&>p]:mb-1 [&>p:last-child]:mb-0">
      {children}
    </blockquote>
  ),

  // Lists
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="my-3 ml-1 space-y-1.5 list-none [&>li]:relative [&>li]:pl-5 [&>li]:before:content-['▸'] [&>li]:before:absolute [&>li]:before:left-0 [&>li]:before:text-[rgba(var(--accent-rgb)/0.60)] [&>li]:before:text-xs [&>li]:before:top-[5px]">
      {children}
    </ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="my-3 ml-1 space-y-1.5 list-none counter-reset-[list-counter] [&>li]:relative [&>li]:pl-7 [&>li]:counter-increment-[list-counter] [&>li]:before:content-[counter(list-counter)] [&>li]:before:absolute [&>li]:before:left-0 [&>li]:before:w-5 [&>li]:before:h-5 [&>li]:before:rounded-full [&>li]:before:bg-[rgba(var(--accent-rgb)/0.15)] [&>li]:before:text-[var(--accent-400)] [&>li]:before:text-[11px] [&>li]:before:flex [&>li]:before:items-center [&>li]:before:justify-center [&>li]:before:top-[3px] [&>li]:before:font-semibold">
      {children}
    </ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="text-[15px] leading-7 text-[var(--text-secondary)]">{children}</li>
  ),

  // Tables
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="my-6 overflow-x-auto rounded-xl border border-[var(--muted-border)]">
      <table className="w-full text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }: { children?: React.ReactNode }) => (
    <thead className="bg-[rgba(var(--accent-rgb)/0.08)] border-b border-[var(--muted-border)]">{children}</thead>
  ),
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className="px-4 py-2.5 text-left text-xs font-semibold text-[rgba(var(--accent-rgb)/0.80)] uppercase tracking-wider">
      {children}
    </th>
  ),
  tbody: ({ children }: { children?: React.ReactNode }) => (
    <tbody className="divide-y divide-[var(--muted-border)]">{children}</tbody>
  ),
  tr: ({ children }: { children?: React.ReactNode }) => (
    <tr className="hover:bg-[var(--row-hover)] transition-colors">{children}</tr>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <td className="px-4 py-2.5 text-[13px] text-[var(--text-secondary)]">{children}</td>
  ),

  // Horizontal rule
  hr: () => (
    <hr className="my-8 border-0 h-px bg-gradient-to-r from-transparent via-[var(--muted-border)] to-transparent" />
  ),

  // Images
  img: ({ src, alt }: ComponentPropsWithoutRef<'img'>) => (
    <span className="block my-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={typeof src === 'string' ? src : undefined} alt={alt ?? ''} className="rounded-xl border border-[var(--muted-border)] max-w-full" />
    </span>
  ),

  // Code: detect block vs inline
  pre: ({ children }: PreProps) => {
    // react-markdown wraps code blocks in <pre><code>. Extract the code element.
    if (
      children &&
      typeof children === 'object' &&
      'type' in (children as React.ReactElement) &&
      (children as React.ReactElement).type === 'code'
    ) {
      const codeEl = children as React.ReactElement<{ className?: string; children: string }>;
      return (
        <CodeBlock className={codeEl.props.className}>
          {String(codeEl.props.children)}
        </CodeBlock>
      );
    }
    return <pre className="my-4 overflow-x-auto">{children}</pre>;
  },

  code: ({ className, children }: { className?: string; children?: React.ReactNode }) => {
    // If inside a pre block, the pre handler will handle it. This catches inline code only.
    if (className?.startsWith('language-')) return <code className={className}>{children}</code>;
    return <InlineCode>{children}</InlineCode>;
  },
};

/* -------------------------------------------------------------------------- */
/*  Premium Markdown component                                                */
/* -------------------------------------------------------------------------- */

interface PremiumMarkdownProps {
  source: string;
  className?: string;
}

/** @description Premium dark-themed markdown renderer with shiki syntax highlighting, GFM tables, and polished typography. */
export function PremiumMarkdown({ source, className = '' }: PremiumMarkdownProps) {
  return (
    <div className={`premium-markdown ${className}`}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={components}
      >
        {source}
      </Markdown>
    </div>
  );
}
