import type { AgentRun } from '@shared/types'
import { UserMessage } from '../UserMessage'
import { ActionChip } from './ActionChip'
import { QuestionCard } from './QuestionCard'
import { NarrationText } from './NarrationText'
import { ReasoningBlock } from './ReasoningBlock'
import { LiveStatus } from './LiveStatus'
import { GoalCard } from './GoalCard'
import { Summary } from './Summary'

type AgentRunViewProps = {
    run: AgentRun
}

export function AgentRunView({ run }: AgentRunViewProps) {
    const finished = run.status === 'done' || run.status === 'stopped' || run.status === 'error'

    const lastItem = run.items[run.items.length - 1]
    const lastIsRunningAction = lastItem?.kind === 'action' && lastItem.status === 'running'

    const lastIsActiveReasoning = lastItem?.kind === 'reasoning' && !!lastItem.text
    const showLiveStatus =
        !finished &&
        run.status !== 'planning' &&
        run.status !== 'waiting' &&
        !lastIsActiveReasoning &&
        !lastIsRunningAction

    return (
        <div className="pt-12 flex flex-col gap-4">
            <UserMessage content={run.request} />
            <div className="flex flex-col gap-3">
                {(run.goal || run.status === 'planning') && (
                    <GoalCard goal={run.goal} criteria={run.criteria} status={run.status} />
                )}
                <div className="flex flex-col gap-2.5">
                    {run.items
                        .filter((item) =>
                            item.kind === 'question'
                                ? true
                                : item.kind === 'action'
                                    ? item.tool !== 'ask_user'
                                    : !!item.text
                        )
                        .map((item) =>
                            item.kind === 'text' ? (
                                <NarrationText key={item.id} text={item.text!} />
                            ) : item.kind === 'reasoning' ? (
                                <ReasoningBlock
                                    key={item.id}
                                    text={item.text!}
                                    active={!finished && item.id === lastItem?.id}
                                />
                            ) : item.kind === 'question' ? (
                                <QuestionCard key={item.id} item={item} />
                            ) : (
                                <ActionChip key={item.id} item={item} />
                            )
                        )}
                    {showLiveStatus && <LiveStatus status={run.status} />}
                </div>
                {finished && run.summary && <Summary status={run.status} summary={run.summary} />}
            </div>
        </div>
    )
}
