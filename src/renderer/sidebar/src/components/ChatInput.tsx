import React, { useState, useRef, useEffect } from 'react'
import { ArrowUp, Bot } from 'lucide-react'
import { cn } from '@common/lib/utils'
import { Button } from '@common/components/Button'
import { useChat } from '../contexts/ChatContext'

// Chat Input Component with pill design
export const ChatInput: React.FC<{
    onSend: (message: string) => void
    disabled: boolean
}> = ({ onSend, disabled }) => {
    const { agentMode, setAgentMode } = useChat()
    const [value, setValue] = useState('')
    const [isFocused, setIsFocused] = useState(false)
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'
            const scrollHeight = textareaRef.current.scrollHeight
            const newHeight = Math.min(scrollHeight, 200) // Max 200px
            textareaRef.current.style.height = `${newHeight}px`
        }
    }, [value])

    const handleSubmit = () => {
        if (value.trim() && !disabled) {
            onSend(value.trim())
            setValue('')
            // Reset textarea height
            if (textareaRef.current) {
                textareaRef.current.style.height = '24px'
            }
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSubmit()
        }
    }

    return (
        <div className={cn(
            "w-full border p-3 rounded-3xl bg-background dark:bg-secondary",
            "shadow-chat animate-spring-scale outline-none transition-all duration-200",
            isFocused ? "border-primary/20 dark:border-primary/30" : "border-border"
        )}>
            {/* Input Area */}
            <div className="w-full px-3 py-2">
                <div className="w-full flex items-start gap-3">
                    <div className="relative flex-1 overflow-hidden">
                        <textarea
                            ref={textareaRef}
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            onFocus={() => setIsFocused(true)}
                            onBlur={() => setIsFocused(false)}
                            onKeyDown={handleKeyDown}
                            placeholder={agentMode ? "Tell the agent what to do..." : "Send a message..."}
                            className="w-full resize-none outline-none bg-transparent
                                     text-foreground placeholder:text-muted-foreground
                                     min-h-[24px] max-h-[200px]"
                            rows={1}
                            style={{ lineHeight: '24px' }}
                        />
                    </div>
                </div>
            </div>

            {/* Send Button */}
            <div className="w-full flex items-center gap-1.5 px-1 mt-2 mb-1">
                <Button
                    variant="ghost"
                    onClick={() => setAgentMode(!agentMode)}
                    title={agentMode ? "Agent mode on — messages control the browser" : "Enable agent mode"}
                    className={cn(
                        "h-9 px-3 rounded-full gap-1.5 font-medium border transition-all duration-200",
                        agentMode
                            ? "bg-primary/10 border-primary/30 text-primary hover:bg-primary/10"
                            : "bg-transparent border-border text-muted-foreground hover:text-foreground hover:bg-transparent"
                    )}
                >
                    <Bot className="size-4" />
                    Agent
                </Button>
                <div className="flex-1" />
                <button
                    onClick={handleSubmit}
                    disabled={disabled || !value.trim()}
                    className={cn(
                        "size-9 rounded-full flex items-center justify-center",
                        "transition-all duration-200",
                        "bg-primary text-primary-foreground",
                        "hover:opacity-80 disabled:opacity-50"
                    )}
                >
                    <ArrowUp className="size-5" />
                </button>
            </div>
        </div>
    )
}
