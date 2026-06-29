import React from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'

const components: Components = {
    h1: ({ children }) => (
        <h1 className="text-lg font-semibold text-foreground mt-4 mb-2 first:mt-0">{children}</h1>
    ),
    h2: ({ children }) => (
        <h2 className="text-base font-semibold text-foreground mt-4 mb-2 first:mt-0">{children}</h2>
    ),
    h3: ({ children }) => (
        <h3 className="text-sm font-semibold text-foreground mt-3 mb-1.5 first:mt-0">{children}</h3>
    ),
    h4: ({ children }) => (
        <h4 className="text-sm font-medium text-foreground mt-3 mb-1.5 first:mt-0">{children}</h4>
    ),
    p: ({ children }) => (
        <p className="text-sm leading-relaxed text-foreground my-2 first:mt-0 last:mb-0">{children}</p>
    ),
    ul: ({ children }) => (
        <ul className="list-disc pl-5 my-2 space-y-1 text-sm text-foreground marker:text-muted-foreground">
            {children}
        </ul>
    ),
    ol: ({ children }) => (
        <ol className="list-decimal pl-5 my-2 space-y-1 text-sm text-foreground marker:text-muted-foreground">
            {children}
        </ol>
    ),
    li: ({ children }) => <li className="leading-relaxed">{children}</li>,
    blockquote: ({ children }) => (
        <blockquote className="border-l-2 border-border pl-3 my-2 text-sm text-muted-foreground italic">
            {children}
        </blockquote>
    ),
    hr: () => <hr className="my-3 border-border" />,
    strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
    em: ({ children }) => <em className="italic">{children}</em>,
    a: ({ children, href }) => (
        <a
            href={href}
            className="text-primary underline underline-offset-2 break-words [overflow-wrap:anywhere]"
            target="_blank"
            rel="noopener noreferrer"
        >
            {children}
        </a>
    ),
    code: ({ className, children, ...props }) => {
        const isBlock = Boolean(className)
        return isBlock ? (
            <code className={`${className ?? ''} text-sm`} {...props}>
                {children}
            </code>
        ) : (
            <code
                className="bg-muted dark:bg-muted/50 px-1 py-0.5 rounded text-[0.85em] text-foreground break-words"
                {...props}
            >
                {children}
            </code>
        )
    },
    pre: ({ children }) => (
        <pre className="bg-muted dark:bg-muted/50 p-3 rounded-lg my-2 overflow-x-auto text-foreground">
            {children}
        </pre>
    ),
    table: ({ children }) => (
        <div className="my-2 overflow-x-auto">
            <table className="w-full text-sm border-collapse">{children}</table>
        </div>
    ),
    th: ({ children }) => (
        <th className="border border-border px-2 py-1 text-left font-semibold text-foreground">
            {children}
        </th>
    ),
    td: ({ children }) => (
        <td className="border border-border px-2 py-1 text-foreground">{children}</td>
    ),
}

export const Markdown: React.FC<{ content: string }> = ({ content }) => (
    <div className="text-sm text-foreground break-words [overflow-wrap:anywhere]">
        <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={components}>
            {content}
        </ReactMarkdown>
    </div>
)
