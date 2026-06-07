import { useState } from 'react'
import { Brain, ChevronRight } from 'lucide-react'
import { cn } from '@common/lib/utils'

type ReasoningBlockProps = {
    text: string
    active: boolean
}

export function ReasoningBlock({ text, active }: ReasoningBlockProps) {
    const [open, setOpen] = useState(false)
    const preview = text.trim().split('\n').filter(Boolean).pop() ?? ''

    return (
        <div className="animate-fade-in">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
                <Brain className={cn('size-3.5', active && 'text-foreground')} />
                <span
                    className={cn(
                        active &&
                            'bg-gradient-to-r from-muted-foreground via-foreground to-muted-foreground bg-[length:200%_100%] bg-clip-text text-transparent animate-shimmer'
                    )}
                >
                    {active ? 'Thinking…' : 'Thought process'}
                </span>
                <ChevronRight className={cn('size-3 transition-transform', open && 'rotate-90')} />
            </button>
            {open ? (
                <div className="mt-1.5 ml-1.5 pl-3 border-l-2 border-border max-h-48 overflow-y-auto text-xs text-muted-foreground italic whitespace-pre-wrap leading-relaxed">
                    {text}
                </div>
            ) : (
                active &&
                preview && (
                    <div className="mt-1 ml-5 text-xs text-muted-foreground/70 italic truncate">
                        {preview}
                    </div>
                )
            )}
        </div>
    )
}
