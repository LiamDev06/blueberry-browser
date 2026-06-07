import React from 'react'
import { Plus } from 'lucide-react'
import { useChat } from '../contexts/ChatContext'
import { Button } from '@common/components/Button'
import { ChatInput } from './ChatInput'
import { AgentRunningBar } from './AgentRunningBar'
import { AgentRunView } from './AgentRunView'
import { useAutoScroll } from './useAutoScroll'
import { ConversationTurn, ConversationTurnComponent } from './ConversationTurnComponent'

// Main Chat Component
export const Chat: React.FC = () => {
    const { messages, isLoading, agentMode, agentRuns, sendMessage, clearChat, stopAgent } = useChat()
    const scrollRef = useAutoScroll(
        messages.length + agentRuns.reduce((n, r) => n + r.items.length, 0)
    )

    const isAgentRunning = agentMode && isLoading
    const isEmpty = messages.length === 0 && agentRuns.length === 0

    // Group messages into conversation turns
    const conversationTurns: ConversationTurn[] = []
    for (let i = 0; i < messages.length; i++) {
        if (messages[i].role === 'user') {
            const turn: ConversationTurn = { user: messages[i] }
            if (messages[i + 1]?.role === 'assistant') {
                turn.assistant = messages[i + 1]
                i++ // Skip next message since we've paired it
            }
            conversationTurns.push(turn)
        } else if (messages[i].role === 'assistant' &&
            (i === 0 || messages[i - 1]?.role !== 'user')) {
            // Handle standalone assistant messages
            conversationTurns.push({ assistant: messages[i] })
        }
    }

    // Check if we need to show loading after the last turn
    const showLoadingAfterLastTurn = isLoading &&
        messages[messages.length - 1]?.role === 'user'

    return (
        <div className="flex flex-col h-full bg-background">
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto">
                <div className="h-8 max-w-3xl mx-auto px-4">
                    {/* New Chat Button - Floating */}
                    {!isEmpty && (
                        <Button
                            onClick={clearChat}
                            title="Start new chat"
                            variant="ghost"
                        >
                            <Plus className="size-4" />
                            New Chat
                        </Button>
                    )}
                </div>

                <div className="pb-4 relative max-w-3xl mx-auto px-4">

                    {isEmpty ? (
                        // Empty State
                        <div className="flex items-center justify-center h-full min-h-[400px]">
                            <div className="text-center animate-fade-in max-w-md mx-auto gap-2 flex flex-col">
                                <h3 className="text-2xl font-bold">🫐</h3>
                                <p className="text-muted-foreground text-sm">
                                    Press ⌘E to toggle the sidebar
                                </p>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Render conversation turns */}
                            {conversationTurns.map((turn, index) => (
                                <ConversationTurnComponent
                                    key={`turn-${index}`}
                                    turn={turn}
                                    isLoading={
                                        showLoadingAfterLastTurn &&
                                        index === conversationTurns.length - 1
                                    }
                                />
                            ))}

                            {agentRuns.map((run) => (
                                <AgentRunView key={run.id} run={run} />
                            ))}
                        </>
                    )}

                    {/* Scroll anchor */}
                    <div ref={scrollRef} />
                </div>
            </div>

            {/* Input Area */}
            <div className="p-4">
                {isAgentRunning ? (
                    <AgentRunningBar onStop={stopAgent} />
                ) : (
                    <ChatInput onSend={sendMessage} disabled={isLoading} />
                )}
            </div>
        </div>
    )
}
