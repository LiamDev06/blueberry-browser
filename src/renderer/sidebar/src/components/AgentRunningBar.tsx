import { Square } from 'lucide-react'
import { Button } from '@common/components/Button'

type AgentRunningBarProps = {
    onStop: () => void
}

export function AgentRunningBar({ onStop }: AgentRunningBarProps) {
    return (
        <div className="w-full flex items-center gap-3 border border-primary/30 p-4 rounded-3xl
                        bg-primary/5 shadow-chat animate-spring-scale">
            <span className="relative flex size-2.5 shrink-0">
                <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-60 animate-ping" />
                <span className="relative inline-flex rounded-full size-2.5 bg-primary" />
            </span>
            <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground">Agent is working…</div>
                <div className="text-xs text-muted-foreground">
                    The browser is being controlled. You cannot interact with the page.
                </div>
            </div>
            <Button
                variant="destructive"
                onClick={onStop}
                title="Stop the agent and take back control"
                className="rounded-full"
            >
                <Square className="size-3.5 fill-current" />
                Stop
            </Button>
        </div>
    )
}
