"use client";

import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

export default function MarkdownRenderer({ content }: { content: string }) {
  const components: Components = {
    // Headings
    h1: ({ ...props }) => (
      <h1 className="text-3xl font-bold mb-4 mt-8 first:mt-0" {...props} />
    ),
    h2: ({ ...props }) => (
      <h2 className="text-2xl font-bold mb-3 mt-6 first:mt-0" {...props} />
    ),
    h3: ({ ...props }) => (
      <h3 className="text-xl font-bold mb-2 mt-4 first:mt-0" {...props} />
    ),
    h4: ({ ...props }) => (
      <h4 className="text-lg font-bold mb-2 mt-4 first:mt-0" {...props} />
    ),
    h5: ({ ...props }) => (
      <h5 className="text-base font-bold mb-2 mt-4 first:mt-0" {...props} />
    ),
    h6: ({ ...props }) => (
      <h6 className="text-sm font-bold mb-2 mt-4 first:mt-0" {...props} />
    ),
    // Paragraphs
    p: ({ ...props }) => (
      <p
        className="mb-4 last:mb-0 text-slate-700 dark:text-slate-300 leading-relaxed"
        {...props}
      />
    ),
    // Code blocks
    pre: ({ ...props }) => (
      <pre
        className="bg-slate-100 dark:bg-slate-800 p-4 rounded-lg overflow-x-auto my-4"
        {...props}
      />
    ),
    code: (props) => {
      const { className, children, ...rest } = props;
      const match = /language-(\w+)/.exec(className || "");
      const isInline = !match;
      return isInline ? (
        <code
          className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-sm font-mono"
          {...rest}
        >
          {children}
        </code>
      ) : (
        <code className={`text-sm font-mono ${className || ""}`} {...rest}>
          {children}
        </code>
      );
    },
    // Lists
    ul: ({ ...props }) => (
      <ul className="list-disc list-outside mb-4 space-y-2 ml-6 text-slate-700 dark:text-slate-300" {...props} />
    ),
    ol: ({ ...props }) => (
      <ol
        className="list-decimal list-outside mb-4 space-y-2 ml-6 text-slate-700 dark:text-slate-300"
        {...props}
      />
    ),
    li: ({ ...props }) => <li className="pl-2" {...props} />,
    // Links
    a: ({ ...props }) => (
      <a
        className="text-blue-600 dark:text-blue-400 hover:underline"
        target="_blank"
        rel="noopener noreferrer"
        {...props}
      />
    ),
    // Blockquotes
    blockquote: ({ ...props }) => (
      <blockquote
        className="border-l-4 border-slate-300 dark:border-slate-600 pl-4 italic my-4 text-slate-600 dark:text-slate-400"
        {...props}
      />
    ),
    // Horizontal rule
    hr: ({ ...props }) => (
      <hr className="my-6 border-slate-300 dark:border-slate-700" {...props} />
    ),
    // Strong and emphasis
    strong: ({ ...props }) => <strong className="font-semibold" {...props} />,
    em: ({ ...props }) => <em className="italic" {...props} />,
    // Tables (from remark-gfm)
    table: ({ ...props }) => (
      <div className="overflow-x-auto my-4">
        <table
          className="border-collapse border border-slate-300 dark:border-slate-700"
          {...props}
        />
      </div>
    ),
    thead: ({ ...props }) => (
      <thead className="bg-slate-100 dark:bg-slate-800" {...props} />
    ),
    tbody: ({ ...props }) => <tbody {...props} />,
    tr: ({ ...props }) => <tr {...props} />,
    th: ({ ...props }) => (
      <th
        className="border border-slate-300 dark:border-slate-700 px-4 py-2 font-semibold text-slate-900 dark:text-slate-100"
        {...props}
      />
    ),
    td: ({ ...props }) => (
      <td
        className="border border-slate-300 dark:border-slate-700 px-4 py-2 text-slate-700 dark:text-slate-300"
        {...props}
      />
    ),
  };

  return (
    <Markdown remarkPlugins={[remarkGfm]} components={components}>
      {content}
    </Markdown>
  );
}

