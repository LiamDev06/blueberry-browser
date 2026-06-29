import { useEffect, useState } from 'react'
import { Sparkles, X, ChevronRight, Loader2 } from 'lucide-react'
import type { RemixPromptData, RemixVersion } from '@shared/remix'

export function RemixPrompt() {
    const [data, setData] = useState<RemixPromptData | null>(null)
    const [loadingId, setLoadingId] = useState<string | null>(null)

    useEffect(() => {
        window.sidebarAPI.onRemixPrompt((next) => {
            setData(next)
            setLoadingId(null)
        })
        return () => window.sidebarAPI.removeRemixPromptListener()
    }, [])

    if (!data || data.versions.length === 0) {
        return null
    }

    function load(version: RemixVersion) {
        setLoadingId(version.id)
        window.sidebarAPI.loadRemix(version.id)
    }

    function dismiss() {
        setData(null)
        window.sidebarAPI.dismissRemix()
    }

    const count = data.versions.length

    return (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20">
            <div className="bg-background px-3 pt-3">
                <div className="pointer-events-auto rounded-2xl border border-border bg-muted p-3.5 shadow-sm">
                    <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                            <Sparkles className="size-4 text-violet-500 dark:text-violet-400" />
                            You remixed this page
                        </div>
                        <button
                            onClick={dismiss}
                            aria-label="Dismiss"
                            className="text-muted-foreground hover:text-foreground"
                        >
                            <X className="size-3.5" />
                        </button>
                    </div>
                    <div className="text-xs text-muted-foreground mb-2.5">
                        {count === 1
                            ? 'Load your saved version?'
                            : `Load one of your ${count} saved versions?`}
                    </div>
                    <div className="flex flex-col gap-1.5 max-h-44 overflow-y-auto">
                        {data.versions.map((version) => (
                            <button
                                key={version.id}
                                onClick={() => load(version)}
                                disabled={loadingId !== null}
                                className="group flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-2.5 py-2 text-left hover:bg-accent disabled:opacity-60"
                            >
                                <span className="truncate text-sm text-foreground">{version.label}</span>
                                {loadingId === version.id ? (
                                    <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
                                ) : (
                                    <ChevronRight className="size-4 shrink-0 text-muted-foreground/50 group-hover:text-foreground" />
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
            <div className="h-4 bg-gradient-to-b from-background to-transparent" />
        </div>
    )
}
