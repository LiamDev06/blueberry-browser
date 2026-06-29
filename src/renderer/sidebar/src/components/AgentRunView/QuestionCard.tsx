import { useState } from 'react'
import { MessageCircleQuestion, ArrowUp, Check } from 'lucide-react'
import { cn } from '@common/lib/utils'
import type { QuestionItem } from '@shared/types'
import { useChat } from '../../contexts/ChatContext'

type QuestionCardProps = {
    item: QuestionItem
}

export function QuestionCard({ item }: QuestionCardProps) {
    const { answerQuestion } = useChat()
    const [text, setText] = useState('')
    const [submitting, setSubmitting] = useState(false)

    const answered = item.answer != null
    const options = item.options ?? []

    function submit(answer: string) {
        const trimmed = answer.trim()
        if (!trimmed || submitting || answered) {
            return
        }
        setSubmitting(true)
        answerQuestion(item.id, trimmed)
    }

    return (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-3.5 animate-fade-in">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
                <MessageCircleQuestion className="size-3.5" />
                {answered ? 'You answered' : 'Agent needs your input'}
            </div>

            {item.question && (
                <div className="text-sm text-foreground mb-3">{item.question}</div>
            )}

            {answered ? (
                <div className="flex items-start gap-2 text-sm">
                    <Check className="size-4 text-green-500 mt-0.5 shrink-0" />
                    <span className="text-foreground">{item.answer}</span>
                </div>
            ) : (
                <div className="flex flex-col gap-2">
                    {options.length > 0 && (
                        <div className="flex flex-col gap-1.5">
                            {options.map((option, index) => (
                                <button
                                    key={index}
                                    onClick={() => submit(option)}
                                    disabled={submitting}
                                    className={cn(
                                        'text-left text-sm rounded-xl border border-border bg-background px-3 py-2',
                                        'transition-colors duration-150',
                                        'hover:border-primary/40 hover:bg-primary/5',
                                        'disabled:opacity-50 disabled:hover:border-border disabled:hover:bg-background'
                                    )}
                                >
                                    {option}
                                </button>
                            ))}
                        </div>
                    )}

                    <div className={cn(
                        'flex items-end gap-2 rounded-2xl border border-border bg-background p-1.5 pl-3',
                        'focus-within:border-primary/30 transition-colors duration-150'
                    )}>
                        <textarea
                            value={text}
                            onChange={(event) => setText(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter' && !event.shiftKey) {
                                    event.preventDefault()
                                    submit(text)
                                }
                            }}
                            placeholder={options.length > 0 ? 'Or type your own answer…' : 'Type your answer…'}
                            disabled={submitting}
                            rows={1}
                            className="flex-1 resize-none outline-none bg-transparent text-sm leading-6
                                       text-foreground placeholder:text-muted-foreground
                                       py-1.5 min-h-[24px] max-h-[160px]"
                        />
                        <button
                            onClick={() => submit(text)}
                            disabled={submitting || !text.trim()}
                            title="Send your answer"
                            className={cn(
                                'size-8 rounded-full flex items-center justify-center shrink-0',
                                'bg-primary text-primary-foreground transition-opacity duration-150',
                                'hover:opacity-80 disabled:opacity-40'
                            )}
                        >
                            <ArrowUp className="size-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
