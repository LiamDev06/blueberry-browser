import { CheckCircle2, AlertCircle, StopCircle } from 'lucide-react'
import { cn } from '@common/lib/utils'
import type { RunStatus } from '@shared/types'
import { Markdown } from '../Markdown'

type SummaryProps = {
    status: RunStatus
    summary: string
}

export function Summary({ status, summary }: SummaryProps) {
    const Marker = status === 'done' ? CheckCircle2 : status === 'stopped' ? StopCircle : AlertCircle
    const color = status === 'done' ? 'text-green-500' : status === 'error' ? 'text-red-500' : 'text-muted-foreground'

    return (
        <div className="flex items-start gap-2 pt-1 animate-fade-in">
            <Marker className={cn('size-4 mt-1 shrink-0', color)} />
            <div className="flex-1 min-w-0">
                <Markdown content={summary} />
            </div>
        </div>
    )
}
