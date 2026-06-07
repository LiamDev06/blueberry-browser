import { Target, CheckCircle2, Circle } from 'lucide-react'
import { cn } from '@common/lib/utils'
import type { AgentCriterion, RunStatus } from '@shared/types'

type GoalCardProps = {
    goal: string
    criteria: AgentCriterion[]
    status: RunStatus
}

export function GoalCard({ goal, criteria, status }: GoalCardProps) {
    return (
        <div className="rounded-2xl border border-border bg-muted/30 p-3.5">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
                <Target className="size-3.5" />
                {status === 'planning' ? 'Planning…' : 'Goal'}
            </div>
            {goal && <div className="text-sm text-foreground mb-2.5">{goal}</div>}
            {criteria.length > 0 && (
                <div className="flex flex-col gap-1.5">
                    {criteria.map((criterion, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm">
                            {criterion.met ? (
                                <CheckCircle2 className="size-4 text-green-500 mt-0.5 shrink-0" />
                            ) : (
                                <Circle className={cn(
                                    'size-4 mt-0.5 shrink-0',
                                    criterion.met === false ? 'text-muted-foreground' : 'text-muted-foreground/40'
                                )} />
                            )}
                            <span className={criterion.met ? 'text-foreground' : 'text-muted-foreground'}>
                                {criterion.text}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
