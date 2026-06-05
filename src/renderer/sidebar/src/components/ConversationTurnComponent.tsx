import React from 'react'
import { Message } from './types'
import { UserMessage } from './UserMessage'
import { AssistantMessage } from './AssistantMessage'
import { LoadingIndicator } from './LoadingIndicator'

// Conversation Turn Component
export interface ConversationTurn {
    user?: Message
    assistant?: Message
}

export const ConversationTurnComponent: React.FC<{
    turn: ConversationTurn
    isLoading?: boolean
}> = ({ turn, isLoading }) => (
    <div className="pt-12 flex flex-col gap-8">
        {turn.user && <UserMessage content={turn.user.content} />}
        {turn.assistant && (
            <AssistantMessage
                content={turn.assistant.content}
                isStreaming={turn.assistant.isStreaming}
            />
        )}
        {isLoading && (
            <div className="flex justify-start">
                <LoadingIndicator />
            </div>
        )}
    </div>
)
