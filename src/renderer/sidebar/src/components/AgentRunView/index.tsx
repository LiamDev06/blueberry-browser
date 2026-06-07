import type { AgentRun } from '@shared/types'
import { UserMessage } from '../UserMessage'
import { ActionChip } from './ActionChip'
import { NarrationText } from './NarrationText'
import { GoalCard } from './GoalCard'
import { Summary } from './Summary'

type AgentRunViewProps = {
    run: AgentRun
}

export function AgentRunView({ run }: AgentRunViewProps) {
    const finished = run.status === 'done' || run.status === 'stopped' || run.status === 'error'
    
    return (
        <div className="pt-12 flex flex-col gap-4">
            <UserMessage content={run.request} />
            <div className="flex flex-col gap-3">
                {(run.goal || run.status === 'planning') && (
                    <GoalCard goal={run.goal} criteria={run.criteria} status={run.status} />
                )}
                <div className="flex flex-col gap-2.5">
                    {run.items.map((item) =>
                        item.kind === 'text'
                            ? item.text && <NarrationText key={item.id} text={item.text} />
                            : <ActionChip key={item.id} item={item} />
                    )}
                </div>
                {finished && run.summary && <Summary status={run.status} summary={run.summary} />}
            </div>
        </div>
    )
}
