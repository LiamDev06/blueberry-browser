import { useEffect, useState } from 'react'
import { Sparkles, X, ChevronRight, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import type { RemixPromptData, RemixVersion } from '@shared/remix'

export function RemixPrompt() {
    const [data, setData] = useState<RemixPromptData | null>(null)
    const [loadingId, setLoadingId] = useState<string | null>(null)
    const [collapsed, setCollapsed] = useState(false)

    useEffect(() => {
        window.sidebarAPI.onRemixPrompt((next) => {
            setData(next)
            setLoadingId(null)
            setCollapsed(false)
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
        <div className="pointer-events-none absolute inset-x-0 bottom-full z-20 px-3 pb-2">
            <div className="pointer-events-auto rounded-2xl border border-border bg-muted shadow-lg">
                <div className="flex items-center justify-between gap-2 p-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                        <Sparkles className="size-4 text-violet-500 dark:text-violet-400" />
                        You remixed this page
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                        <button
                            onClick={() => setCollapsed((value) => !value)}
                            aria-label={collapsed ? 'Expand' : 'Collapse'}
                            className="hover:text-foreground"
                        >
                            {collapsed ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                        </button>
                        <button onClick={dismiss} aria-label="Dismiss" className="hover:text-foreground">
                            <X className="size-3.5" />
                        </button>
                    </div>
                </div>
                {!collapsed && (
                    <div className="px-3 pb-3">
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
                )}
            </div>
        </div>
    )
}
