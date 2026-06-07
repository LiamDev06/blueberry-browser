import { Loader2 } from 'lucide-react'
import type { RunStatus } from '@shared/types'

type LiveStatusProps = {
    status: RunStatus
}

export function LiveStatus({ status }: LiveStatusProps) {
    const label = status === 'validating' ? 'Checking the result…' : 'Thinking…'

    return (
        <div className="flex items-center gap-2.5 text-sm animate-fade-in">
            <span className="flex items-center justify-center size-6 rounded-lg shrink-0 bg-muted text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
            </span>
            <span className="bg-gradient-to-r from-muted-foreground via-foreground to-muted-foreground bg-[length:200%_100%] bg-clip-text text-transparent animate-shimmer">
                {label}
            </span>
        </div>
    )
}
