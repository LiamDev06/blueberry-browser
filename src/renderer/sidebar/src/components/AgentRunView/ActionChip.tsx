import { Loader2, Check, AlertCircle, Circle } from 'lucide-react'
import { cn } from '@common/lib/utils'
import type { ActionItem } from '@shared/types'
import { TOOL_META } from './toolMeta'

type ActionChipProps = {
    item: ActionItem
}

export function ActionChip({ item }: ActionChipProps) {
    const meta = TOOL_META[item.tool]
    const Icon = meta?.icon ?? Circle
    const isError = item.status === 'error'

    return (
        <div className="flex items-center gap-2.5 text-sm animate-fade-in">
            <span className={cn(
                'flex items-center justify-center size-6 rounded-lg shrink-0',
                isError ? 'bg-red-500/10 text-red-500' : 'bg-muted text-muted-foreground'
            )}>
                <Icon className="size-3.5" />
            </span>
            <span className="text-foreground truncate">
                {item.title ?? meta?.runningLabel ?? 'Working…'}
            </span>
            <span className="ml-auto shrink-0 flex items-center">
                {item.status === 'running' ? (
                    <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                ) : isError ? (
                    <AlertCircle className="size-3.5 text-red-500" />
                ) : (
                    <Check className="size-3.5 text-green-500" />
                )}
            </span>
        </div>
    )
}
